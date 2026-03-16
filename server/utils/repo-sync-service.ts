import type { H3Event } from 'h3'
import type { GitHubRepoDetail, GitHubPullRequest, RepoDetail } from '~~/shared/types/repository'
import type { WorkItem } from '~~/shared/types/work-item'
import type { RepoSyncMeta } from '~~/server/utils/repo-cache'
import { getSessionToken, githubFetchAllWithToken, githubCachedFetchWithToken, githubFetchWithToken, GitHubError } from '~~/server/utils/github'
import { getSharedToken } from '~~/server/utils/github-app'
import { toRepoDetail } from '~~/shared/utils/repository'
import {
  readMeta, writeMeta, reconcileMeta,
  readRepoDetail, writeRepoDetail,
  readWorkItems, writeWorkItems,
  acquireSyncLock, releaseSyncLock,
  touchActivity, isStale, isVeryOld,
  listKnownRepoMetaEntries,
} from '~~/server/utils/repo-cache'
import {
  buildWorkItemsFromRaw, filterByState,
  collectIssueLinksFromText, chunk,
  type GitHubIssueWithPull,
} from '~~/server/utils/work-item-builder'

// Re-export cache invalidation so existing consumers keep working
export { invalidateSharedRepoDetailCache, invalidateSharedWorkItemsCache } from '~~/server/utils/repo-cache'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DETAIL_STALE_MS = 5 * 60_000 // 5 min
const WORK_ITEMS_STALE_MS = 2 * 60_000 // 2 min
const FULL_SYNC_MAX_AGE_MS = 6 * 60 * 60_000 // 6 h
const INCREMENTAL_MAX_AGE_MS = 20 * 60_000 // 20 min
const MAX_INCREMENTAL_DELTA_ITEMS = 120
const HOT_REPO_WINDOW_MS = 30 * 60_000 // 30 min
const WARM_REPO_WINDOW_MS = 6 * 60 * 60_000 // 6 h
const COLD_REPO_WINDOW_MS = 24 * 60 * 60_000 // 24 h

const MAINTENANCE_HOT_WORK_ITEMS_MS = 2 * 60_000 // 2 min
const MAINTENANCE_HOT_DETAIL_MS = 10 * 60_000 // 10 min
const MAINTENANCE_WARM_WORK_ITEMS_MS = 20 * 60_000 // 20 min
const MAINTENANCE_WARM_DETAIL_MS = 60 * 60_000 // 60 min
const MAINTENANCE_MAX_REPOS_PER_RUN = 30

// ---------------------------------------------------------------------------
// GitHub fetch: repo detail (with ETag support for background sync)
// ---------------------------------------------------------------------------
async function fetchRepoDetailFromGitHub(
  token: string,
  owner: string,
  repo: string,
  etag: string | null,
): Promise<{ detail: RepoDetail, etag: string | null, notModified: boolean }> {
  const url = new URL(`/repos/${owner}/${repo}`, 'https://api.github.com')
  const headers: Record<string, string> = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (etag) headers['If-None-Match'] = etag

  const response = await fetch(url, { headers })

  if (response.status === 304) {
    return { detail: null as unknown as RepoDetail, etag, notModified: true }
  }

  if (!response.ok) {
    throw new GitHubError(response.status, `/repos/${owner}/${repo}`, `GitHub API ${response.status}`)
  }

  const raw = await response.json() as GitHubRepoDetail
  return {
    detail: toRepoDetail(raw),
    etag: response.headers.get('etag'),
    notModified: false,
  }
}

// ---------------------------------------------------------------------------
// GitHub fetch: work items
// ---------------------------------------------------------------------------
async function fetchCanonicalIssues(
  token: string,
  owner: string,
  repo: string,
  since?: string,
): Promise<GitHubIssueWithPull[]> {
  const params: Record<string, string> = { state: 'all', sort: 'updated', direction: 'desc' }
  if (since) params.since = since

  const response = await githubFetchAllWithToken<GitHubIssueWithPull>(
    token,
    `/repos/${owner}/${repo}/issues`,
    { params },
  )

  return response.data
}

async function fetchPullDetailsForIssues(
  token: string,
  owner: string,
  repo: string,
  issues: GitHubIssueWithPull[],
): Promise<Map<number, GitHubPullRequest & { body?: string }>> {
  const pullNumbers = issues.filter(i => 'pull_request' in i).map(i => i.number)
  return fetchPullDetailsByNumbers(token, owner, repo, pullNumbers)
}

async function fetchPullDetailsByNumbers(
  token: string,
  owner: string,
  repo: string,
  pullNumbers: number[],
): Promise<Map<number, GitHubPullRequest & { body?: string }>> {
  const unique = Array.from(new Set(pullNumbers))
  const details = new Map<number, GitHubPullRequest & { body?: string }>()
  if (!unique.length) return details

  for (const batch of chunk(unique, 25)) {
    const results = await Promise.all(
      batch.map(async (number) => {
        try {
          const { data } = await githubFetchWithToken<GitHubPullRequest & { body?: string }>(
            token,
            `/repos/${owner}/${repo}/pulls/${number}`,
          )
          return { number, data }
        }
        catch (error) {
          console.error('[repo-sync] Failed to fetch pull detail for enrichment', { owner, repo, number, error })
          return { number, data: null }
        }
      }),
    )

    for (const entry of results) {
      if (entry.data) details.set(entry.number, entry.data)
    }
  }

  return details
}

async function fetchAllWorkItemsFromGitHub(
  token: string,
  owner: string,
  repo: string,
): Promise<WorkItem[]> {
  const issues = await fetchCanonicalIssues(token, owner, repo)
  const pullDetails = await fetchPullDetailsForIssues(token, owner, repo, issues)
  return buildWorkItemsFromRaw(token, owner, repo, issues, pullDetails)
}

async function fetchIssueByNumber(
  token: string,
  owner: string,
  repo: string,
  number: number,
): Promise<GitHubIssueWithPull | null> {
  try {
    const { data } = await githubFetchWithToken<GitHubIssueWithPull>(token, `/repos/${owner}/${repo}/issues/${number}`)
    return data
  }
  catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 404) return null
    throw error
  }
}

// ---------------------------------------------------------------------------
// Incremental sync helpers
// ---------------------------------------------------------------------------
function mapByNumber(items: WorkItem[]): Map<number, WorkItem> {
  return new Map(items.map(item => [item.number, item]))
}

function mergeWorkItemsByNumber(existing: WorkItem[], replacement: WorkItem[], affectedNumbers: Set<number>): WorkItem[] {
  const replacementMap = new Map<number, WorkItem>(replacement.map(item => [item.number, item]))
  const preserved = existing.filter(item => !affectedNumbers.has(item.number))
  const merged = [...preserved, ...Array.from(replacementMap.values())]
  return merged
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function collectRelatedNumbersFromCache(affected: Set<number>, cachedByNumber: Map<number, WorkItem>): boolean {
  let grew = false

  for (const number of Array.from(affected)) {
    const cached = cachedByNumber.get(number)
    if (!cached) continue

    if (cached.type === 'issue') {
      for (const linkedPull of cached.linkedPulls) {
        if (affected.has(linkedPull.number)) continue
        affected.add(linkedPull.number)
        grew = true
      }
    }
    else {
      for (const linkedIssue of cached.linkedIssues) {
        if (affected.has(linkedIssue.number)) continue
        affected.add(linkedIssue.number)
        grew = true
      }
    }
  }

  return grew
}

interface IncrementalBuildResult {
  mode: 'incremental' | 'full'
  data?: WorkItem[]
  affectedCount?: number
  deltaCount?: number
}

async function buildIncrementalWorkItems(
  token: string,
  owner: string,
  repo: string,
  cached: WorkItem[],
  since: string,
): Promise<IncrementalBuildResult> {
  const deltaIssues = await fetchCanonicalIssues(token, owner, repo, since)

  if (!deltaIssues.length) {
    return { mode: 'incremental', data: cached, affectedCount: 0, deltaCount: 0 }
  }

  if (deltaIssues.length > MAX_INCREMENTAL_DELTA_ITEMS) {
    return { mode: 'full', deltaCount: deltaIssues.length }
  }

  const cachedByNumber = mapByNumber(cached)
  const affected = new Set<number>(deltaIssues.map(item => item.number))
  collectRelatedNumbersFromCache(affected, cachedByNumber)

  if (affected.size > MAX_INCREMENTAL_DELTA_ITEMS * 2) {
    return { mode: 'full', deltaCount: deltaIssues.length, affectedCount: affected.size }
  }

  const fetchedByNumber = new Map<number, GitHubIssueWithPull | null>()

  const fetchMissing = async (): Promise<void> => {
    const missing = Array.from(affected).filter(number => !fetchedByNumber.has(number))
    if (!missing.length) return

    for (const batch of chunk(missing, 20)) {
      const results = await Promise.all(batch.map(number => fetchIssueByNumber(token, owner, repo, number)))
      for (let i = 0; i < batch.length; i += 1) {
        const number = batch[i]
        if (number === undefined) continue
        fetchedByNumber.set(number, results[i] ?? null)
      }
    }
  }

  await fetchMissing()

  const expandFromCurrentPullLinks = async (): Promise<void> => {
    const pullSnapshots = Array.from(fetchedByNumber.values()).filter((entry): entry is GitHubIssueWithPull =>
      !!entry && 'pull_request' in entry,
    )
    const pullDetails = await fetchPullDetailsForIssues(token, owner, repo, pullSnapshots)

    let expanded = false
    for (const pullSnapshot of pullSnapshots) {
      const pull = pullDetails.get(pullSnapshot.number)
      const linkedIssues = collectIssueLinksFromText(pull?.body)
      for (const linkedIssueNumber of linkedIssues) {
        if (affected.has(linkedIssueNumber)) continue
        affected.add(linkedIssueNumber)
        expanded = true
      }
    }

    if (!expanded) return
    if (affected.size > MAX_INCREMENTAL_DELTA_ITEMS * 2) {
      throw new Error('INCREMENTAL_AFFECTED_SET_TOO_LARGE')
    }

    collectRelatedNumbersFromCache(affected, cachedByNumber)
    if (affected.size > MAX_INCREMENTAL_DELTA_ITEMS * 2) {
      throw new Error('INCREMENTAL_AFFECTED_SET_TOO_LARGE')
    }

    await fetchMissing()
  }

  try {
    await expandFromCurrentPullLinks()
  }
  catch {
    return { mode: 'full', deltaCount: deltaIssues.length, affectedCount: affected.size }
  }

  const currentAffectedSnapshots = Array.from(fetchedByNumber.values())
    .filter((entry): entry is GitHubIssueWithPull => !!entry)

  const pullDetails = await fetchPullDetailsForIssues(token, owner, repo, currentAffectedSnapshots)
  const rebuiltAffectedItems = await buildWorkItemsFromRaw(token, owner, repo, currentAffectedSnapshots, pullDetails)

  const merged = mergeWorkItemsByNumber(cached, rebuiltAffectedItems, affected)
  return {
    mode: 'incremental',
    data: merged,
    affectedCount: affected.size,
    deltaCount: deltaIssues.length,
  }
}

// ---------------------------------------------------------------------------
// Sync orchestration
// ---------------------------------------------------------------------------
async function syncRepoDetail(
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  if (!await acquireSyncLock(owner, repo, 'detail')) return

  const meta = await readMeta(owner, repo)
  meta.detailSyncStatus = 'running'
  await writeMeta(owner, repo, meta)

  try {
    const result = await fetchRepoDetailFromGitHub(token, owner, repo, meta.detailEtag)

    if (!result.notModified) {
      await writeRepoDetail(owner, repo, result.detail)
      meta.detailEtag = result.etag
      meta.visibility = result.detail.visibility === 'private' ? 'private' : 'public'
    }

    meta.detailSyncedAt = Date.now()
    meta.detailSyncStatus = 'idle'
    meta.detailLastError = null
    await writeMeta(owner, repo, reconcileMeta(meta))
  }
  catch (error) {
    meta.detailSyncStatus = 'failed'
    meta.detailLastError = error instanceof Error ? error.message : String(error)
    await writeMeta(owner, repo, reconcileMeta(meta))
    console.error(`[repo-sync] Detail sync failed for ${owner}/${repo}:`, error)
  }
  finally {
    await releaseSyncLock(owner, repo, 'detail')
  }
}

interface WorkItemsSyncDecision {
  mode: 'full' | 'incremental'
  reason: string
}

function decideWorkItemsSyncMode(meta: RepoSyncMeta, hasWorkItemsCache: boolean): WorkItemsSyncDecision {
  if (!hasWorkItemsCache) return { mode: 'full', reason: 'cache-missing' }
  if (!meta.workItemsSyncedAt) return { mode: 'full', reason: 'never-synced' }
  if (!meta.lastFullSyncAt) return { mode: 'full', reason: 'never-full-synced' }
  if (meta.workItemsSyncStatus === 'failed') return { mode: 'full', reason: 'previous-work-items-failed' }

  if (isVeryOld(meta.lastFullSyncAt, FULL_SYNC_MAX_AGE_MS)) {
    return { mode: 'full', reason: 'full-sync-too-old' }
  }

  if (isVeryOld(meta.workItemsSyncedAt, INCREMENTAL_MAX_AGE_MS)) {
    return { mode: 'full', reason: 'incremental-window-expired' }
  }

  return { mode: 'incremental', reason: 'recent-cache-eligible' }
}

async function syncWorkItems(
  token: string,
  owner: string,
  repo: string,
  mode: 'full' | 'incremental',
): Promise<void> {
  if (!await acquireSyncLock(owner, repo, 'work-items')) return

  const meta = await readMeta(owner, repo)
  meta.workItemsSyncStatus = 'running'
  await writeMeta(owner, repo, meta)

  try {
    const cached = await readWorkItems(owner, repo)
    const modeDecision = mode === 'incremental'
      ? decideWorkItemsSyncMode(meta, Boolean(cached))
      : { mode: 'full' as const, reason: 'forced-full' }

    let nextItems: WorkItem[]

    if (modeDecision.mode === 'incremental' && meta.workItemsSyncedAt && cached) {
      const since = new Date(meta.workItemsSyncedAt).toISOString()
      const incremental = await buildIncrementalWorkItems(token, owner, repo, cached.data, since)

      if (incremental.mode === 'incremental' && incremental.data) {
        nextItems = incremental.data
      }
      else {
        const allItems = await fetchAllWorkItemsFromGitHub(token, owner, repo)
        nextItems = allItems
        meta.lastFullSyncAt = Date.now()
      }
    }
    else {
      const allItems = await fetchAllWorkItemsFromGitHub(token, owner, repo)
      nextItems = allItems
      meta.lastFullSyncAt = Date.now()
    }

    await writeWorkItems(owner, repo, nextItems)
    meta.workItemsSyncedAt = Date.now()
    meta.workItemsSyncStatus = 'idle'
    meta.workItemsLastError = null
    await writeMeta(owner, repo, reconcileMeta(meta))
  }
  catch (error) {
    meta.workItemsSyncStatus = 'failed'
    meta.workItemsLastError = error instanceof Error ? error.message : String(error)
    await writeMeta(owner, repo, reconcileMeta(meta))
    console.error(`[repo-sync] Work items sync failed for ${owner}/${repo}:`, error)
  }
  finally {
    await releaseSyncLock(owner, repo, 'work-items')
  }
}

function triggerBackgroundDetailSync(token: string, owner: string, repo: string): void {
  syncRepoDetail(token, owner, repo).catch(() => {})
}

function triggerBackgroundWorkItemsSync(token: string, owner: string, repo: string, mode: 'full' | 'incremental'): void {
  syncWorkItems(token, owner, repo, mode).catch(() => {})
}

// ---------------------------------------------------------------------------
// User-fallback cached functions (per-user cache for private repos)
// ---------------------------------------------------------------------------
const userCachedRepoDetail = defineCachedFunction(
  async (_login: string, token: string, userId: number, owner: string, repo: string) => {
    const { data } = await githubCachedFetchWithToken<GitHubRepoDetail>(token, userId, `/repos/${owner}/${repo}`)
    return toRepoDetail(data)
  },
  {
    maxAge: 300,
    name: 'repo-detail',
    getKey: (login: string, _token: string, _userId: number, owner: string, repo: string) =>
      `${login}/${owner}/${repo}`,
  },
)

const userCachedWorkItems = defineCachedFunction(
  async (_login: string, token: string, owner: string, repo: string, state: 'open' | 'closed' | 'all'): Promise<WorkItem[]> => {
    const issues = await fetchCanonicalIssues(token, owner, repo)
    const pullDetails = await fetchPullDetailsForIssues(token, owner, repo, issues)
    const allItems = await buildWorkItemsFromRaw(token, owner, repo, issues, pullDetails)
    return filterByState(allItems, state)
  },
  {
    maxAge: 120,
    name: 'work-items-user',
    getKey: (login: string, _token: string, owner: string, repo: string, state: string) =>
      `${login}/${owner}/${repo}:${state}`,
  },
)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get repository details.
 *
 * 1. Check shared cache → return if fresh, background-refresh if stale.
 * 2. Cold cache → fetch with user token, return immediately.
 *    - If public: populate shared cache + register for background sync.
 *    - If private: short-lived per-user cache only.
 */
export async function getRepoDetailsForRequest(
  event: H3Event,
  owner: string,
  repo: string,
): Promise<RepoDetail> {
  const sharedToken = getSharedToken()

  if (sharedToken) {
    // Check shared cache first
    const cached = await readRepoDetail(owner, repo)

    if (cached) {
      touchActivity(owner, repo).catch(() => {})

      if (!isStale(cached.fetchedAt, DETAIL_STALE_MS)) {
        return cached.data
      }
      // Stale — return cached, trigger background refresh
      triggerBackgroundDetailSync(sharedToken, owner, repo)
      return cached.data
    }

    // Cold cache — fetch with user token so private repos work too
    const { token: userToken } = await getSessionToken(event)
    const { data: raw } = await githubFetchWithToken<GitHubRepoDetail>(userToken, `/repos/${owner}/${repo}`)
    const detail = toRepoDetail(raw)

    // Public repo → populate shared cache and register for background sync
    if (detail.visibility !== 'private') {
      touchActivity(owner, repo).catch(() => {})
      await writeRepoDetail(owner, repo, detail)

      const meta = await readMeta(owner, repo)
      meta.detailSyncedAt = Date.now()
      meta.visibility = 'public'
      meta.detailSyncStatus = 'idle'
      meta.detailLastError = null
      await writeMeta(owner, repo, reconcileMeta(meta))

      // Start background sync with shared PAT for future requests
      triggerBackgroundDetailSync(sharedToken, owner, repo)
    }

    return detail
  }

  // No shared PAT configured — per-user cache fallback
  const { token, userId, login } = await getSessionToken(event)
  return userCachedRepoDetail(login, token, userId, owner, repo)
}

/**
 * Get work items for a repository.
 *
 * 1. Check shared cache → return if fresh, background-refresh if stale.
 * 2. Cold cache → fetch with user token, return immediately.
 *    - If repo is known-public (from meta) or visibly public: populate shared cache.
 *    - Otherwise: short-lived per-user cache only.
 */
export async function getRepoWorkItemsForRequest(
  event: H3Event,
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all',
): Promise<WorkItem[]> {
  const sharedToken = getSharedToken()

  if (sharedToken) {
    // Check shared cache first
    const cached = await readWorkItems(owner, repo)
    const meta = await readMeta(owner, repo)

    if (cached) {
      touchActivity(owner, repo).catch(() => {})

      if (!isStale(cached.fetchedAt, WORK_ITEMS_STALE_MS)) {
        return filterByState(cached.data, state)
      }
      // Stale — return cached, trigger background sync
      const mode = decideWorkItemsSyncMode(meta, true)
      triggerBackgroundWorkItemsSync(sharedToken, owner, repo, mode.mode)
      return filterByState(cached.data, state)
    }

    // Cold cache — fetch with user token
    const { token: userToken } = await getSessionToken(event)
    const allItems = await fetchAllWorkItemsFromGitHub(userToken, owner, repo)

    // Only populate shared cache for public repos
    if (meta.visibility === 'public') {
      touchActivity(owner, repo).catch(() => {})
      await writeWorkItems(owner, repo, allItems)

      meta.workItemsSyncedAt = Date.now()
      meta.lastFullSyncAt = Date.now()
      meta.workItemsSyncStatus = 'idle'
      meta.workItemsLastError = null
      await writeMeta(owner, repo, reconcileMeta(meta))

      // Start background sync with shared PAT
      triggerBackgroundWorkItemsSync(sharedToken, owner, repo, 'incremental')
    }

    return filterByState(allItems, state)
  }

  // No shared PAT configured — per-user cache fallback
  const { token, login } = await getSessionToken(event)
  return userCachedWorkItems(login, token, owner, repo, state)
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------
type RepoActivityClass = 'hot' | 'warm' | 'cold'

function classifyRepoActivity(meta: RepoSyncMeta): RepoActivityClass {
  const now = Date.now()
  const ageSinceRequest = meta.lastRequestedAt ? now - meta.lastRequestedAt : Number.MAX_SAFE_INTEGER

  if (ageSinceRequest <= HOT_REPO_WINDOW_MS && meta.requestCount >= 5) return 'hot'
  if (ageSinceRequest <= WARM_REPO_WINDOW_MS && meta.requestCount >= 2) return 'warm'
  if (ageSinceRequest <= COLD_REPO_WINDOW_MS) return 'warm'
  return 'cold'
}

function shouldRefreshByCadence(lastSyncedAt: number | null, cadenceMs: number): boolean {
  if (!lastSyncedAt) return true
  return Date.now() - lastSyncedAt > cadenceMs
}

async function warmRepoByActivity(token: string, owner: string, repo: string, meta: RepoSyncMeta, activity: RepoActivityClass): Promise<void> {
  if (activity === 'cold') return

  const detailCadence = activity === 'hot' ? MAINTENANCE_HOT_DETAIL_MS : MAINTENANCE_WARM_DETAIL_MS
  const workItemsCadence = activity === 'hot' ? MAINTENANCE_HOT_WORK_ITEMS_MS : MAINTENANCE_WARM_WORK_ITEMS_MS

  if (shouldRefreshByCadence(meta.detailSyncedAt, detailCadence)) {
    await syncRepoDetail(token, owner, repo)
  }

  const hasWorkItemsCache = Boolean(await readWorkItems(owner, repo))
  if (!shouldRefreshByCadence(meta.workItemsSyncedAt, workItemsCadence)) return

  const decision = decideWorkItemsSyncMode(meta, hasWorkItemsCache)
  await syncWorkItems(token, owner, repo, decision.mode)
}

export interface SharedRepoMaintenanceResult {
  inspected: number
  warmed: number
  skipped: number
}

export async function runSharedRepoMaintenanceCycle(): Promise<SharedRepoMaintenanceResult> {
  const token = getSharedToken()
  if (!token) {
    return { inspected: 0, warmed: 0, skipped: 0 }
  }

  const knownRepos = await listKnownRepoMetaEntries()
  const sorted = knownRepos
    .sort((a, b) => (b.meta.lastRequestedAt ?? 0) - (a.meta.lastRequestedAt ?? 0))
    .slice(0, MAINTENANCE_MAX_REPOS_PER_RUN)

  let warmed = 0
  let skipped = 0

  for (const repoEntry of sorted) {
    const activity = classifyRepoActivity(repoEntry.meta)
    if (activity === 'cold') {
      skipped += 1
      continue
    }

    await warmRepoByActivity(token, repoEntry.owner, repoEntry.repo, repoEntry.meta, activity)
    warmed += 1
  }

  return {
    inspected: sorted.length,
    warmed,
    skipped,
  }
}
