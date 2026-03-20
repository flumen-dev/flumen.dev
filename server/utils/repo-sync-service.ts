import type { H3Event } from 'h3'
import type { GitHubRepoDetail, GitHubPullRequest, RepoDetail } from '~~/shared/types/repository'
import type { WorkItem } from '~~/shared/types/work-item'
import type { RepoSyncMeta } from '~~/server/utils/repo-cache'
import { getSessionToken, githubFetchAllWithToken, githubCachedFetchWithToken, githubFetchWithToken, GitHubError } from '~~/server/utils/github'
import { getSharedToken } from '~~/server/utils/github-app'
import { getCronSecret } from '~~/server/utils/cron-auth'
import { toRepoDetail } from '~~/shared/utils/repository'
import {
  SYNC_LOCK_TTL_MS,
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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DETAIL_STALE_MS = 5 * 60_000 // 5 min
const WORK_ITEMS_STALE_MS = 10 * 60_000 // 10 min
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
const FAST_WORK_ITEMS_PAGE_SIZE = 30

function triggerInternalRepoSync(event: H3Event, owner: string, repo: string, reason: string): Promise<Response> {
  const cronSecret = getCronSecret()
  if (!cronSecret) {
    throw new Error('CRON_SECRET (or NUXT_CRON_SECRET) is required to trigger internal repo sync endpoint')
  }

  const url = new URL('/cron/cache/sync/repo', getRequestURL(event).origin)
  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cronSecret}`,
      'x-cron-secret': cronSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ owner, repo, reason }),
  })
}

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

  const startedAt = Date.now()
  let pagesFetched = 0
  console.log('[repo-sync] canonical issues fetch started', { owner, repo, since: since ?? null })

  const response = await githubFetchAllWithToken<GitHubIssueWithPull>(
    token,
    `/repos/${owner}/${repo}/issues`,
    {
      params,
      onPageFetched: ({ page, pageItems, totalItems }) => {
        pagesFetched = page
        if (page === 1 || page % 10 === 0) {
          console.log('[repo-sync] canonical issues fetch progress', {
            owner,
            repo,
            page,
            pageItems,
            totalItems,
            elapsedMs: Date.now() - startedAt,
          })
        }
      },
    },
  )

  console.log('[repo-sync] canonical issues fetch completed', {
    owner,
    repo,
    since: since ?? null,
    items: response.data.length,
    pagesFetched,
    elapsedMs: Date.now() - startedAt,
  })

  return response.data
}

async function fetchCanonicalIssuesPage(
  token: string,
  owner: string,
  repo: string,
  perPage: number,
): Promise<{ issues: GitHubIssueWithPull[], hasNextPage: boolean }> {
  const { data, headers } = await githubFetchWithToken<GitHubIssueWithPull[]>(
    token,
    `/repos/${owner}/${repo}/issues`,
    {
      params: {
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: Math.min(Math.max(perPage, 1), 100),
        page: 1,
      },
    },
  )

  const linkHeader = headers.get('link')
  const hasNextPage = Boolean(linkHeader && /rel="next"/.test(linkHeader))

  return { issues: data, hasNextPage }
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

  let rateLimited = false

  for (const batch of chunk(unique, 5)) {
    if (rateLimited) break

    const results = await Promise.all(
      batch.map(async (number) => {
        try {
          const { data } = await githubFetchWithToken<GitHubPullRequest & { body?: string }>(
            token,
            `/repos/${owner}/${repo}/pulls/${number}`,
          )
          return { number, data, error: null as unknown }
        }
        catch (error) {
          const status = (error as { status?: number })?.status
          if (status === 403) {
            rateLimited = true
          }
          console.error('[repo-sync] Failed to fetch pull detail for enrichment', { owner, repo, number, error })
          return { number, data: null, error }
        }
      }),
    )

    for (const entry of results) {
      if (entry.data) details.set(entry.number, entry.data)
    }

    if (rateLimited) {
      console.warn('[repo-sync] Pull detail enrichment stopped due to rate limit', { owner, repo })
      break
    }
  }

  return details
}

async function fetchAllWorkItemsFromGitHub(
  token: string,
  owner: string,
  repo: string,
): Promise<WorkItem[]> {
  const startedAt = Date.now()
  console.log('[repo-sync] full work-items build started', { owner, repo })

  const issues = await fetchCanonicalIssues(token, owner, repo)
  console.log('[repo-sync] full work-items build issues fetched', {
    owner,
    repo,
    issues: issues.length,
    elapsedMs: Date.now() - startedAt,
  })

  const pullDetails = new Map<number, GitHubPullRequest & { body?: string }>()
  const workItems = await buildWorkItemsFromRaw(owner, repo, issues, pullDetails)

  console.log('[repo-sync] full work-items build completed', {
    owner,
    repo,
    issues: issues.length,
    workItems: workItems.length,
    elapsedMs: Date.now() - startedAt,
  })

  return workItems
}

async function fetchTopWorkItemsFromGitHub(
  token: string,
  owner: string,
  repo: string,
  limit: number,
): Promise<{ items: WorkItem[], hasNextPage: boolean }> {
  const startedAt = Date.now()
  const { issues, hasNextPage } = await fetchCanonicalIssuesPage(token, owner, repo, limit)
  const pullDetails = new Map<number, GitHubPullRequest & { body?: string }>()
  const workItems = await buildWorkItemsFromRaw(owner, repo, issues, pullDetails)
  console.log('[repo-sync] fast work-items build completed', {
    owner,
    repo,
    issueSample: issues.length,
    workItems: workItems.length,
    hasNextPage,
    elapsedMs: Date.now() - startedAt,
  })
  return { items: workItems, hasNextPage }
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
  const startedAt = Date.now()
  console.log('[repo-sync] incremental work-items build started', {
    owner,
    repo,
    since,
    cachedCount: cached.length,
  })

  const deltaIssues = await fetchCanonicalIssues(token, owner, repo, since)

  console.log('[repo-sync] incremental delta fetched', {
    owner,
    repo,
    deltaCount: deltaIssues.length,
    elapsedMs: Date.now() - startedAt,
  })

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
  const rebuiltAffectedItems = await buildWorkItemsFromRaw(owner, repo, currentAffectedSnapshots, pullDetails)

  const merged = mergeWorkItemsByNumber(cached, rebuiltAffectedItems, affected)
  console.log('[repo-sync] incremental work-items build completed', {
    owner,
    repo,
    deltaCount: deltaIssues.length,
    affectedCount: affected.size,
    resultCount: merged.length,
    elapsedMs: Date.now() - startedAt,
  })
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
  if (!await acquireSyncLock(owner, repo, 'detail')) {
    console.log('[repo-sync] detail-sync skipped (lock active)', { owner, repo })
    return
  }

  console.log('[repo-sync] detail-sync started', { owner, repo })

  const meta = await readMeta(owner, repo)
  const syncStartedAt = Date.now()
  meta.detailSyncStatus = 'running'
  meta.detailSyncStartedAt = syncStartedAt
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
    meta.detailSyncStartedAt = null
    meta.detailLastError = null
    await writeMeta(owner, repo, reconcileMeta(meta))
    const elapsedMs = Date.now() - syncStartedAt
    if (elapsedMs > SYNC_LOCK_TTL_MS * 0.8) {
      console.warn('[repo-sync] sync duration approaching lock TTL', {
        owner,
        repo,
        scope: 'detail',
        elapsedMs,
        lockTtlMs: SYNC_LOCK_TTL_MS,
      })
    }
    console.log('[repo-sync] detail-sync completed', {
      owner,
      repo,
      notModified: result.notModified,
      visibility: meta.visibility,
    })
  }
  catch (error) {
    meta.detailSyncStatus = 'failed'
    meta.detailSyncStartedAt = null
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
  if (!await acquireSyncLock(owner, repo, 'work-items')) {
    console.log('[repo-sync] work-items sync skipped (lock active)', { owner, repo, requestedMode: mode })
    return
  }

  const meta = await readMeta(owner, repo)
  const syncStartedAt = Date.now()
  console.log('[repo-sync] work-items sync started', {
    owner,
    repo,
    requestedMode: mode,
    visibility: meta.visibility,
    previousWorkItemsSyncedAt: meta.workItemsSyncedAt,
    previousLastFullSyncAt: meta.lastFullSyncAt,
  })
  meta.workItemsSyncStatus = 'running'
  meta.workItemsSyncStartedAt = syncStartedAt
  await writeMeta(owner, repo, meta)

  try {
    const cached = await readWorkItems(owner, repo)
    const modeDecision = mode === 'incremental'
      ? decideWorkItemsSyncMode(meta, Boolean(cached))
      : { mode: 'full' as const, reason: 'forced-full' }
    console.log('[repo-sync] work-items sync decision', {
      owner,
      repo,
      requestedMode: mode,
      selectedMode: modeDecision.mode,
      reason: modeDecision.reason,
      cachedCount: cached?.data.length ?? 0,
    })

    let nextItems: WorkItem[]

    if (modeDecision.mode === 'incremental' && meta.workItemsSyncedAt && cached) {
      const since = new Date(meta.workItemsSyncedAt).toISOString()
      const incremental = await buildIncrementalWorkItems(token, owner, repo, cached.data, since)

      if (incremental.mode === 'incremental' && incremental.data) {
        nextItems = incremental.data
        console.log('[repo-sync] work-items incremental applied', {
          owner,
          repo,
          deltaCount: incremental.deltaCount ?? 0,
          affectedCount: incremental.affectedCount ?? 0,
          resultCount: nextItems.length,
        })
      }
      else {
        console.log('[repo-sync] work-items incremental switched to full fetch', {
          owner,
          repo,
          elapsedMs: Date.now() - syncStartedAt,
        })
        const allItems = await fetchAllWorkItemsFromGitHub(token, owner, repo)
        nextItems = allItems
        meta.lastFullSyncAt = Date.now()
        console.log('[repo-sync] work-items incremental fallback to full', {
          owner,
          repo,
          deltaCount: incremental.deltaCount ?? 0,
          affectedCount: incremental.affectedCount ?? 0,
          resultCount: nextItems.length,
        })
      }
    }
    else {
      console.log('[repo-sync] work-items full fetch started', {
        owner,
        repo,
        elapsedMs: Date.now() - syncStartedAt,
      })
      const allItems = await fetchAllWorkItemsFromGitHub(token, owner, repo)
      nextItems = allItems
      meta.lastFullSyncAt = Date.now()
      console.log('[repo-sync] work-items full sync completed', {
        owner,
        repo,
        resultCount: nextItems.length,
      })
    }

    await writeWorkItems(owner, repo, nextItems)
    meta.workItemsSyncedAt = Date.now()
    meta.workItemsSyncStatus = 'idle'
    meta.workItemsSyncStartedAt = null
    meta.workItemsLastError = null
    await writeMeta(owner, repo, reconcileMeta(meta))
    const elapsedMs = Date.now() - syncStartedAt
    if (elapsedMs > SYNC_LOCK_TTL_MS * 0.8) {
      console.warn('[repo-sync] sync duration approaching lock TTL', {
        owner,
        repo,
        scope: 'work-items',
        elapsedMs,
        lockTtlMs: SYNC_LOCK_TTL_MS,
      })
    }
    console.log('[repo-sync] work-items sync completed', {
      owner,
      repo,
      totalItems: nextItems.length,
      syncedAt: meta.workItemsSyncedAt,
      totalElapsedMs: Date.now() - syncStartedAt,
    })
  }
  catch (error) {
    meta.workItemsSyncStatus = 'failed'
    meta.workItemsSyncStartedAt = null
    meta.workItemsLastError = error instanceof Error ? error.message : String(error)
    await writeMeta(owner, repo, reconcileMeta(meta))
    console.error(`[repo-sync] Work items sync failed for ${owner}/${repo}:`, error)
  }
  finally {
    await releaseSyncLock(owner, repo, 'work-items')
  }
}

export async function runSharedRepoSyncForRepo(
  owner: string,
  repo: string,
  reason: string = 'on-demand',
): Promise<void> {
  const token = getSharedToken()
  if (!token) {
    console.warn('[repo-sync] on-demand repo sync skipped (missing shared token)', { owner, repo, reason })
    return
  }

  console.log('[repo-sync] on-demand repo sync started', { owner, repo, reason })
  const startedAt = Date.now()

  await syncRepoDetail(token, owner, repo)

  const meta = await readMeta(owner, repo)
  if (meta.visibility === 'private') {
    console.log('[repo-sync] on-demand repo sync skipped work-items (private repo)', {
      owner,
      repo,
      reason,
      elapsedMs: Date.now() - startedAt,
    })
    return
  }

  const hasWorkItemsCache = Boolean(await readWorkItems(owner, repo))
  const decision = decideWorkItemsSyncMode(meta, hasWorkItemsCache)
  await syncWorkItems(token, owner, repo, decision.mode)

  console.log('[repo-sync] on-demand repo sync completed', {
    owner,
    repo,
    reason,
    mode: decision.mode,
    modeReason: decision.reason,
    elapsedMs: Date.now() - startedAt,
  })
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
    const pullDetails = new Map<number, GitHubPullRequest & { body?: string }>()
    const allItems = await buildWorkItemsFromRaw(owner, repo, issues, pullDetails)
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
 * 1. Check shared cache → return if fresh, return stale immediately if outdated.
 * 2. Cold cache → fetch with user token, return immediately.
 *    - If public: populate shared cache.
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
      // Stale — return cached immediately; refresh is handled by maintenance cron.
      return cached.data
    }

    // Cold cache — fetch with user token so private repos work too
    const { token: userToken } = await getSessionToken(event)
    const { data: raw } = await githubFetchWithToken<GitHubRepoDetail>(userToken, `/repos/${owner}/${repo}`)
    const detail = toRepoDetail(raw)

    // Public repo → populate shared cache
    if (detail.visibility !== 'private') {
      console.log('[repo-sync] cold detail cache visibility', {
        owner,
        repo,
        visibility: detail.visibility,
        sharedCachePopulate: true,
      })
      touchActivity(owner, repo).catch(() => {})
      await writeRepoDetail(owner, repo, detail)

      const meta = await readMeta(owner, repo)
      meta.detailSyncedAt = Date.now()
      meta.visibility = 'public'
      meta.detailSyncStatus = 'idle'
      meta.detailLastError = null
      await writeMeta(owner, repo, reconcileMeta(meta))
    }
    else {
      console.log('[repo-sync] cold detail cache visibility', {
        owner,
        repo,
        visibility: detail.visibility,
        sharedCachePopulate: false,
      })
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
 * 1. Check shared cache → return if fresh, return stale immediately if outdated.
 * 2. Cold cache → fetch with user token, return immediately.
 *    - Shared cache warming is handled by the maintenance cycle.
 */
export async function getRepoWorkItemsForRequest(
  event: H3Event,
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all',
): Promise<WorkItem[]> {
  const sharedToken = getSharedToken()

  if (sharedToken) {
    let activityTouched = false
    // Check shared cache first
    const cached = await readWorkItems(owner, repo)

    if (cached) {
      console.log('[repo-sync] work-items cache hit', {
        owner,
        repo,
        state,
        fetchedAt: cached.fetchedAt,
      })
      touchActivity(owner, repo).catch(() => {})
      activityTouched = true

      const cacheAgeMs = Date.now() - cached.fetchedAt

      if (!isStale(cached.fetchedAt, WORK_ITEMS_STALE_MS)) {
        return filterByState(cached.data, state)
      }

      console.warn('[repo-sync] work-items cache stale, bypassing cached response', {
        owner,
        repo,
        state,
        fetchedAt: cached.fetchedAt,
        cacheAgeMs,
        staleMs: WORK_ITEMS_STALE_MS,
      })
    }

    // Cold cache or too-old cache — fetch fast first page with user token.
    const { token: userToken } = await getSessionToken(event)
    const fastResult = await fetchTopWorkItemsFromGitHub(userToken, owner, repo, FAST_WORK_ITEMS_PAGE_SIZE)
    const fastItems = fastResult.items
    const meta = await readMeta(owner, repo)
    let activityHandledInMetaWrite = false
    let resolvedVisibility = meta.visibility

    if (resolvedVisibility === 'unknown') {
      try {
        const { data: rawRepo } = await githubFetchWithToken<GitHubRepoDetail>(userToken, `/repos/${owner}/${repo}`)
        resolvedVisibility = rawRepo.visibility === 'private' ? 'private' : 'public'
        meta.visibility = resolvedVisibility
        await writeMeta(owner, repo, reconcileMeta(meta))
      }
      catch (error) {
        console.warn('[repo-sync] cold work-items visibility resolution failed', {
          owner,
          repo,
          hasNextPage: fastResult.hasNextPage,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const shouldPopulateSharedCache = !fastResult.hasNextPage && resolvedVisibility === 'public'
    const shouldQueueImmediateSync = fastResult.hasNextPage
      && resolvedVisibility !== 'private'
      && meta.workItemsSyncStatus !== 'running'

    if (shouldPopulateSharedCache) {
      const now = Date.now()
      await writeWorkItems(owner, repo, fastItems)
      meta.workItemsSyncedAt = now
      meta.lastFullSyncAt = now
      meta.workItemsSyncStatus = 'idle'
      meta.workItemsSyncStartedAt = null
      meta.workItemsLastError = null
      meta.lastRequestedAt = now
      meta.requestCount += 1
      activityHandledInMetaWrite = true
      await writeMeta(owner, repo, reconcileMeta(meta))
      console.log('[repo-sync] cold work-items promoted to shared cache', {
        owner,
        repo,
        fetchedCount: fastItems.length,
        hasNextPage: fastResult.hasNextPage,
        visibility: resolvedVisibility,
      })
    }

    if (shouldQueueImmediateSync) {
      meta.workItemsSyncStatus = 'running'
      meta.workItemsSyncStartedAt = Date.now()
      await writeMeta(owner, repo, reconcileMeta(meta))

      console.log('[repo-sync] queued immediate repo sync trigger', {
        owner,
        repo,
        reason: 'partial-fast-response',
        hasNextPage: fastResult.hasNextPage,
      })

      void triggerInternalRepoSync(event, owner, repo, 'partial-fast-response')
        .then(async (response) => {
          if (!response.ok) {
            const responseBody = await response.text().catch(() => '')
            console.warn('[repo-sync] immediate repo sync trigger returned non-ok status', {
              owner,
              repo,
              status: response.status,
              bodySnippet: responseBody.slice(0, 200) || null,
            })
          }
        })
        .catch(async (error) => {
          meta.workItemsSyncStatus = 'failed'
          meta.workItemsSyncStartedAt = null
          meta.workItemsLastError = error instanceof Error ? error.message : String(error)
          await writeMeta(owner, repo, reconcileMeta(meta))

          console.warn('[repo-sync] immediate repo sync trigger failed', {
            owner,
            repo,
            error: meta.workItemsLastError,
          })
        })
    }

    console.log('[repo-sync] cold work-items visibility', {
      owner,
      repo,
      visibility: resolvedVisibility,
      sharedCachePopulate: shouldPopulateSharedCache,
      immediateSyncQueued: shouldQueueImmediateSync,
      hasNextPage: fastResult.hasNextPage,
    })
    if (!activityHandledInMetaWrite && !activityTouched) {
      touchActivity(owner, repo).catch(() => {})
    }
    console.log('[repo-sync] cold work-items fetch complete', {
      owner,
      repo,
      state,
      fetchedCount: fastItems.length,
      hasNextPage: fastResult.hasNextPage,
    })

    return filterByState(fastItems, state)
  }

  // No shared PAT configured — per-user cache fallback
  const { token, login } = await getSessionToken(event)
  return userCachedWorkItems(login, token, owner, repo, state)
}

export interface RepoWorkItemsSyncSnapshot {
  status: 'idle' | 'running' | 'failed'
  lastSyncedAt: number | null
  isPartial: boolean
  lastError: string | null
}

export async function getRepoWorkItemsSyncSnapshot(owner: string, repo: string): Promise<RepoWorkItemsSyncSnapshot> {
  const meta = await readMeta(owner, repo)
  const cached = await readWorkItems(owner, repo)
  const hasStaleSharedCache = Boolean(cached && isStale(cached.fetchedAt, WORK_ITEMS_STALE_MS))
  const isPrivateNoSharedCache = meta.visibility === 'private' && !cached
  const isPartialFromStaleSharedCache = hasStaleSharedCache && meta.visibility !== 'private'
  const isPartialWithoutSharedCache = !isPrivateNoSharedCache
    && !cached
    && !meta.workItemsSyncedAt
    && meta.workItemsSyncStatus !== 'failed'
  return {
    status: meta.workItemsSyncStatus,
    lastSyncedAt: meta.workItemsSyncedAt,
    isPartial: isPartialFromStaleSharedCache
      || isPartialWithoutSharedCache
      || (!isPrivateNoSharedCache && !cached && meta.workItemsSyncStatus === 'running'),
    lastError: meta.workItemsLastError,
  }
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
  const detailNeedsRefresh = shouldRefreshByCadence(meta.detailSyncedAt, detailCadence)
  const workItemsNeedsRefresh = shouldRefreshByCadence(meta.workItemsSyncedAt, workItemsCadence)
  const syncsTriggered: Array<'detail' | 'work-items'> = []
  const syncsSkipped: Array<'detail' | 'work-items'> = []

  if (detailNeedsRefresh) {
    syncsTriggered.push('detail')
    await syncRepoDetail(token, owner, repo)
  }
  else {
    syncsSkipped.push('detail')
  }

  const hasWorkItemsCache = Boolean(await readWorkItems(owner, repo))
  const workItemsDecision = workItemsNeedsRefresh
    ? decideWorkItemsSyncMode(meta, hasWorkItemsCache)
    : null

  if (workItemsNeedsRefresh) {
    syncsTriggered.push('work-items')
    await syncWorkItems(token, owner, repo, workItemsDecision?.mode ?? 'full')
  }
  else {
    syncsSkipped.push('work-items')
  }

  console.log('[repo-sync] maintenance cadence decision', {
    owner,
    repo,
    activity,
    detailCadenceMs: detailCadence,
    workItemsCadenceMs: workItemsCadence,
    detailNeedsRefresh,
    workItemsNeedsRefresh,
    hasWorkItemsCache,
    workItemsMode: workItemsDecision?.mode ?? null,
    workItemsModeReason: workItemsDecision?.reason ?? null,
    syncsTriggered,
    syncsSkipped,
  })
}

export interface SharedRepoMaintenanceResult {
  inspected: number
  warmed: string[]
  skipped: string[]
}

const MAINTENANCE_TIME_BUDGET_MS = 4 * 60_000 // 4 min — leave 1 min headroom

export async function runSharedRepoMaintenanceCycle(): Promise<SharedRepoMaintenanceResult> {
  const token = getSharedToken()
  if (!token) {
    return { inspected: 0, warmed: [], skipped: [] }
  }

  const cycleStartedAt = Date.now()
  const knownRepos = await listKnownRepoMetaEntries()
  const sorted = knownRepos
    .sort((a, b) => (b.meta.lastRequestedAt ?? 0) - (a.meta.lastRequestedAt ?? 0))
    .slice(0, MAINTENANCE_MAX_REPOS_PER_RUN)

  const warmed: string[] = []
  const skipped: string[] = []

  for (const repoEntry of sorted) {
    if (Date.now() - cycleStartedAt > MAINTENANCE_TIME_BUDGET_MS) {
      console.warn('[repo-sync] maintenance time budget exceeded', {
        elapsedMs: Date.now() - cycleStartedAt,
        budgetMs: MAINTENANCE_TIME_BUDGET_MS,
        warmedCount: warmed.length,
        remainingCount: sorted.length - warmed.length - skipped.length,
      })
      skipped.push(...sorted.slice(warmed.length + skipped.length).map(r => `${r.owner}/${r.repo}`))
      break
    }

    const fullName = `${repoEntry.owner}/${repoEntry.repo}`
    const activity = classifyRepoActivity(repoEntry.meta)
    const now = Date.now()
    const detailCadence = activity === 'hot'
      ? MAINTENANCE_HOT_DETAIL_MS
      : activity === 'warm'
        ? MAINTENANCE_WARM_DETAIL_MS
        : null
    const workItemsCadence = activity === 'hot'
      ? MAINTENANCE_HOT_WORK_ITEMS_MS
      : activity === 'warm'
        ? MAINTENANCE_WARM_WORK_ITEMS_MS
        : null
    console.log('[repo-sync] maintenance repo check', {
      owner: repoEntry.owner,
      repo: repoEntry.repo,
      activity,
      requestCount: repoEntry.meta.requestCount,
      lastRequestedAgoMs: repoEntry.meta.lastRequestedAt ? now - repoEntry.meta.lastRequestedAt : null,
      detailNeedsRefresh: detailCadence === null ? null : shouldRefreshByCadence(repoEntry.meta.detailSyncedAt, detailCadence),
      workItemsNeedsRefresh: workItemsCadence === null ? null : shouldRefreshByCadence(repoEntry.meta.workItemsSyncedAt, workItemsCadence),
    })
    if (activity === 'cold') {
      skipped.push(fullName)
      continue
    }

    await warmRepoByActivity(token, repoEntry.owner, repoEntry.repo, repoEntry.meta, activity)
    warmed.push(fullName)
  }

  return {
    inspected: sorted.length,
    warmed,
    skipped,
  }
}
