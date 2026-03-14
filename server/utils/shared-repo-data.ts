import type { H3Event } from 'h3'
import type { GitHubRepoDetail, GitHubIssue, GitHubPullRequest, RepoIssue, RepoPullRequest, RepoDetail } from '~~/shared/types/repository'

import type { WorkItem } from '~~/shared/types/work-item'
import { getSessionToken, githubFetchAllWithToken, githubCachedFetchWithToken, githubFetchWithToken } from '~~/server/utils/github'
import { githubGraphQL } from '~~/server/utils/github-graphql'
import { mapCiStatus } from '~~/server/utils/focus-created'
import { getSharedToken } from '~~/server/utils/github-app'
import { toRepoDetail, toRepoIssue, toRepoPullRequest } from '~~/shared/utils/repository'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DETAIL_STALE_MS = 5 * 60_000 // 5 min
const WORK_ITEMS_STALE_MS = 2 * 60_000 // 2 min
const SYNC_LOCK_TTL_MS = 60_000 // 60 s
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
// Types
// ---------------------------------------------------------------------------
interface RepoSyncMeta {
  visibility: 'unknown' | 'public' | 'private'
  lastRequestedAt: number
  lastSyncedAt: number | null
  detailSyncedAt: number | null
  lastFullSyncAt: number | null
  detailSyncStatus: 'idle' | 'running' | 'failed'
  workItemsSyncStatus: 'idle' | 'running' | 'failed'
  requestCount: number
  detailLastError: string | null
  workItemsLastError: string | null
  detailEtag: string | null
  workItemsSyncedAt: number | null
}

interface LegacyRepoSyncMeta {
  syncStatus?: 'idle' | 'running' | 'failed'
  lastError?: string | null
}

interface SharedCacheEntry<T> {
  data: T
  fetchedAt: number
}

// In-memory dedup — prevents the same process from spawning two syncs
const activeSyncs = new Set<string>()

// ---------------------------------------------------------------------------
// Storage key helpers
// ---------------------------------------------------------------------------
function metaKey(owner: string, repo: string): string {
  return `shared-repo:${owner}~${repo}:meta`
}
function detailKey(owner: string, repo: string): string {
  return `shared-repo:${owner}~${repo}:detail`
}
function workItemsKey(owner: string, repo: string): string {
  return `shared-repo:${owner}~${repo}:work-items`
}
function syncLockKey(owner: string, repo: string, scope: string): string {
  return `shared-repo:${owner}~${repo}:lock:${scope}`
}

// ---------------------------------------------------------------------------
// Storage primitives
// ---------------------------------------------------------------------------
function storage() {
  return useStorage('data')
}

async function readMeta(owner: string, repo: string): Promise<RepoSyncMeta> {
  const existing = await storage().getItem<RepoSyncMeta & LegacyRepoSyncMeta>(metaKey(owner, repo))
  if (!existing) return freshMeta()

  const meta: RepoSyncMeta = {
    ...freshMeta(),
    ...existing,
    detailSyncStatus: existing.detailSyncStatus ?? existing.syncStatus ?? 'idle',
    workItemsSyncStatus: existing.workItemsSyncStatus ?? existing.syncStatus ?? 'idle',
    detailLastError: existing.detailLastError ?? existing.lastError ?? null,
    workItemsLastError: existing.workItemsLastError ?? existing.lastError ?? null,
    detailSyncedAt: existing.detailSyncedAt ?? null,
  }

  return reconcileMeta(meta)
}

async function writeMeta(owner: string, repo: string, meta: RepoSyncMeta): Promise<void> {
  await storage().setItem(metaKey(owner, repo), meta)
}

function freshMeta(): RepoSyncMeta {
  return {
    visibility: 'unknown',
    lastRequestedAt: 0,
    lastSyncedAt: null,
    detailSyncedAt: null,
    lastFullSyncAt: null,
    detailSyncStatus: 'idle',
    workItemsSyncStatus: 'idle',
    requestCount: 0,
    detailLastError: null,
    workItemsLastError: null,
    detailEtag: null,
    workItemsSyncedAt: null,
  }
}

function reconcileMeta(meta: RepoSyncMeta): RepoSyncMeta {
  const lastSyncedAt = [meta.detailSyncedAt, meta.workItemsSyncedAt]
    .filter((value): value is number => typeof value === 'number')
    .reduce<number | null>((latest, current) => {
      if (latest === null) return current
      return current > latest ? current : latest
    }, null)

  return {
    ...meta,
    lastSyncedAt,
  }
}

async function readCache<T>(key: string): Promise<SharedCacheEntry<T> | null> {
  return storage().getItem<SharedCacheEntry<T>>(key)
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  await storage().setItem(key, { data, fetchedAt: Date.now() } satisfies SharedCacheEntry<T>)
}

// ---------------------------------------------------------------------------
// Sync lock with TTL
// ---------------------------------------------------------------------------
async function acquireSyncLock(owner: string, repo: string, scope: string): Promise<boolean> {
  const key = syncLockKey(owner, repo, scope)
  if (activeSyncs.has(key)) return false

  const existing = await storage().getItem<number>(key)
  if (existing && existing + SYNC_LOCK_TTL_MS > Date.now()) return false

  activeSyncs.add(key)
  await storage().setItem(key, Date.now(), { ttl: Math.ceil(SYNC_LOCK_TTL_MS / 1000) })
  return true
}

async function releaseSyncLock(owner: string, repo: string, scope: string): Promise<void> {
  const key = syncLockKey(owner, repo, scope)
  activeSyncs.delete(key)
  await storage().removeItem(key)
}

// ---------------------------------------------------------------------------
// Activity tracking
// ---------------------------------------------------------------------------
async function touchActivity(owner: string, repo: string): Promise<void> {
  const meta = await readMeta(owner, repo)
  meta.lastRequestedAt = Date.now()
  meta.requestCount += 1
  await writeMeta(owner, repo, meta)
}

// ---------------------------------------------------------------------------
// Staleness decisions
// ---------------------------------------------------------------------------
function isStale(fetchedAt: number | null, staleMs: number): boolean {
  if (!fetchedAt) return true
  return Date.now() - fetchedAt > staleMs
}

function isVeryOld(fetchedAt: number | null, veryOldMs: number): boolean {
  if (!fetchedAt) return true
  return Date.now() - fetchedAt > veryOldMs
}

// ---------------------------------------------------------------------------
// GitHub fetch: repo detail
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
    const { GitHubError } = await import('~~/server/utils/github')
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
// GitHub fetch: work items (full pagination)
// ---------------------------------------------------------------------------
const ISSUE_LINK_REGEX = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:#|(?:[\w.-]+\/)?[\w.-]+#)(\d+)/gi

type GitHubIssueWithPull = GitHubIssue & { pull_request?: { url?: string } | unknown }

function collectIssueLinksFromText(text: string | null | undefined): number[] {
  if (!text) return []
  const links: number[] = []
  for (const match of text.matchAll(ISSUE_LINK_REGEX)) {
    const num = Number(match[1])
    if (num && !Number.isNaN(num)) links.push(num)
  }
  return links
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

async function fetchPullInsights(
  token: string,
  owner: string,
  repo: string,
  pullNumbers: number[],
): Promise<Map<number, { reviewDecision: WorkItem['reviewDecision'], ciStatus: WorkItem['ciStatus'] }>> {
  const result = new Map<number, { reviewDecision: WorkItem['reviewDecision'], ciStatus: WorkItem['ciStatus'] }>()
  if (!pullNumbers.length) return result

  for (const batch of chunk(pullNumbers, 40)) {
    const fields = batch
      .map((number, index) => `
        pr${index}: pullRequest(number: ${number}) {
          number
          reviewDecision
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup { state }
              }
            }
          }
        }
      `)
      .join('\n')

    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          ${fields}
        }
      }
    `

    try {
      const data = await githubGraphQL<Record<string, Record<string, {
        number: number
        reviewDecision: WorkItem['reviewDecision']
        commits?: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> }
      } | null>>>(token, query, { owner, repo })

      const repository = data.repository ?? {}
      for (const pull of Object.values(repository)) {
        if (!pull) continue
        const ciRaw = pull.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
        result.set(pull.number, {
          reviewDecision: pull.reviewDecision ?? null,
          ciStatus: mapCiStatus(ciRaw),
        })
      }

      for (const pullNumber of batch) {
        if (!result.has(pullNumber)) {
          result.set(pullNumber, { reviewDecision: null, ciStatus: null })
        }
      }
    }
    catch (error) {
      console.error('[shared-repo-data] Failed to fetch pull insights batch', { owner, repo, batch, error })
      for (const pullNumber of batch) {
        if (!result.has(pullNumber)) {
          result.set(pullNumber, { reviewDecision: null, ciStatus: null })
        }
      }
    }
  }

  return result
}

async function buildWorkItemsFromRaw(
  token: string,
  owner: string,
  repo: string,
  issues: GitHubIssueWithPull[],
  pullDetailsByNumber: Map<number, GitHubPullRequest & { body?: string }>,
): Promise<WorkItem[]> {
  const mappedIssues = issues
    .filter(i => !('pull_request' in i))
    .map(i => toRepoIssue(i))

  const mappedPulls = issues
    .filter(i => 'pull_request' in i)
    .map((issue) => {
      const detail = pullDetailsByNumber.get(issue.number)
      if (detail) return toRepoPullRequest(detail)

      return {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        draft: false,
        htmlUrl: issue.html_url,
        comments: issue.comments,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        user: { login: issue.user.login, avatarUrl: issue.user.avatar_url },
        labels: issue.labels,
        assignees: issue.assignees.map(a => ({ login: a.login, avatarUrl: a.avatar_url })),
        requestedReviewers: [],
        milestone: issue.milestone?.title ?? null,
        headRef: '',
      } satisfies RepoPullRequest
    })

  const pullInsights = await fetchPullInsights(token, owner, repo, mappedPulls.map(pr => pr.number))

  const issueMap = new Map<number, RepoIssue>(mappedIssues.map(issue => [issue.number, issue]))
  const linkedPullsByIssue = new Map<number, RepoPullRequest[]>()
  const linkedIssueNumbersByPull = new Map<number, number[]>()

  for (const pull of mappedPulls) {
    const pullDetail = pullDetailsByNumber.get(pull.number)
    const linkedIssueNumbers = Array.from(new Set(collectIssueLinksFromText(pullDetail?.body)))
    linkedIssueNumbersByPull.set(pull.number, linkedIssueNumbers)

    for (const issueNumber of linkedIssueNumbers) {
      if (!issueMap.has(issueNumber)) continue
      const current = linkedPullsByIssue.get(issueNumber) ?? []
      linkedPullsByIssue.set(issueNumber, [...current, pullDetail ? toRepoPullRequest(pullDetail) : pull])
    }
  }

  const issueWorkItems: WorkItem[] = mappedIssues.map((issue) => {
    const linkedPulls = linkedPullsByIssue.get(issue.number) ?? []
    const primaryLinkedPull = linkedPulls[0] ?? null
    const linkedInsight = primaryLinkedPull ? pullInsights.get(primaryLinkedPull.number) : null
    return {
      id: String(issue.number),
      type: 'issue',
      number: issue.number,
      title: issue.title,
      state: issue.state,
      htmlUrl: issue.htmlUrl,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      author: issue.user,
      labels: issue.labels,
      assignees: issue.assignees,
      commentCount: issue.comments,
      isDraft: primaryLinkedPull?.draft ?? false,
      reviewDecision: linkedInsight?.reviewDecision ?? null,
      ciStatus: linkedInsight?.ciStatus ?? null,
      issue,
      pull: null,
      linkedPulls: linkedPulls.map(pr => ({
        type: 'pull' as const,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        isDraft: pr.draft,
        htmlUrl: pr.htmlUrl,
      })),
      linkedIssues: [],
    }
  })

  const standalonePullWorkItems: WorkItem[] = mappedPulls
    .filter((pr) => {
      const linkedIssues = linkedIssueNumbersByPull.get(pr.number) ?? []
      return linkedIssues.length === 0 || linkedIssues.every(num => !issueMap.has(num))
    })
    .map((pr) => {
      const pullInsight = pullInsights.get(pr.number)
      return {
        id: String(pr.number),
        type: 'pull' as const,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        htmlUrl: pr.htmlUrl,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        author: pr.user,
        labels: pr.labels,
        assignees: pr.assignees,
        commentCount: pr.comments,
        isDraft: pr.draft,
        reviewDecision: pullInsight?.reviewDecision ?? null,
        ciStatus: pullInsight?.ciStatus ?? null,
        issue: null,
        pull: pr,
        linkedPulls: [],
        linkedIssues: (linkedIssueNumbersByPull.get(pr.number) ?? []).map(num => ({
          type: 'issue' as const,
          number: num,
          title: issueMap.get(num)?.title ?? `#${num}`,
          state: issueMap.get(num)?.state,
          htmlUrl: issueMap.get(num)?.htmlUrl ?? `https://github.com/${owner}/${repo}/issues/${num}`,
        })),
      }
    })

  return [...issueWorkItems, ...standalonePullWorkItems]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
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
          console.error('[shared-repo-data] Failed to fetch pull detail for enrichment', { owner, repo, number, error })
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
      await writeCache(detailKey(owner, repo), result.detail)
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
    console.error(`[shared-repo-data] Detail sync failed for ${owner}/${repo}:`, error)
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
    const key = workItemsKey(owner, repo)
    const cached = await readCache<WorkItem[]>(key)
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

    await writeCache(key, nextItems)
    meta.workItemsSyncedAt = Date.now()
    meta.workItemsSyncStatus = 'idle'
    meta.workItemsLastError = null
    await writeMeta(owner, repo, reconcileMeta(meta))
  }
  catch (error) {
    meta.workItemsSyncStatus = 'failed'
    meta.workItemsLastError = error instanceof Error ? error.message : String(error)
    await writeMeta(owner, repo, reconcileMeta(meta))
    console.error(`[shared-repo-data] Work items sync failed for ${owner}/${repo}:`, error)
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
 * Get repository details, preferring shared cache with the configured PAT.
 * Falls back to per-user cache with user token when no PAT is configured.
 */
export async function getRepoDetailsForRequest(
  event: H3Event,
  owner: string,
  repo: string,
): Promise<RepoDetail> {
  const sharedToken = getSharedToken()

  if (sharedToken) {
    touchActivity(owner, repo).catch(() => {})

    const cached = await readCache<RepoDetail>(detailKey(owner, repo))
    const meta = await readMeta(owner, repo)

    if (cached) {
      if (!isStale(cached.fetchedAt, DETAIL_STALE_MS)) {
        return cached.data
      }
      // Stale — return cached, trigger background refresh
      triggerBackgroundDetailSync(sharedToken, owner, repo)
      return cached.data
    }

    // Cold cache — synchronous fetch, populate cache + meta
    const result = await fetchRepoDetailFromGitHub(sharedToken, owner, repo, null)
    await writeCache(detailKey(owner, repo), result.detail)
    meta.detailEtag = result.etag
    meta.detailSyncedAt = Date.now()
    meta.visibility = result.detail.visibility === 'private' ? 'private' : 'public'
    meta.detailSyncStatus = 'idle'
    meta.detailLastError = null
    await writeMeta(owner, repo, reconcileMeta(meta))
    return result.detail
  }

  // Fallback: user token with per-user cache
  const { token, userId, login } = await getSessionToken(event)
  return userCachedRepoDetail(login, token, userId, owner, repo)
}

/**
 * Get work items for a repository, preferring shared canonical cache.
 * The shared cache stores ALL states; filtering happens at read time.
 * Falls back to per-user cache with user token when no PAT is configured.
 */
export async function getRepoWorkItemsForRequest(
  event: H3Event,
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all',
): Promise<WorkItem[]> {
  const sharedToken = getSharedToken()

  if (sharedToken) {
    touchActivity(owner, repo).catch(() => {})

    const key = workItemsKey(owner, repo)
    const cached = await readCache<WorkItem[]>(key)
    const meta = await readMeta(owner, repo)

    if (cached) {
      const fetchedAt = cached.fetchedAt
      if (!isStale(fetchedAt, WORK_ITEMS_STALE_MS)) {
        return filterByState(cached.data, state)
      }
      // Stale — return cached, trigger background sync
      const mode = decideWorkItemsSyncMode(meta, true)
      triggerBackgroundWorkItemsSync(sharedToken, owner, repo, mode.mode)
      return filterByState(cached.data, state)
    }

    // Cold cache — full sync synchronously
    const allItems = await fetchAllWorkItemsFromGitHub(sharedToken, owner, repo)
    await writeCache(key, allItems)
    meta.workItemsSyncedAt = Date.now()
    meta.lastFullSyncAt = Date.now()
    meta.workItemsSyncStatus = 'idle'
    meta.workItemsLastError = null
    await writeMeta(owner, repo, reconcileMeta(meta))
    return filterByState(allItems, state)
  }

  // Fallback: user token with per-user cache
  const { token, login } = await getSessionToken(event)
  return userCachedWorkItems(login, token, owner, repo, state)
}

function filterByState(items: WorkItem[], state: 'open' | 'closed' | 'all'): WorkItem[] {
  if (state === 'all') return items
  return items.filter(item => item.state === state)
}

/**
 * Invalidate shared repo detail cache entry.
 */
export async function invalidateSharedRepoDetailCache(owner: string, repo: string): Promise<void> {
  await storage().removeItem(detailKey(owner, repo))

  const meta = await readMeta(owner, repo)
  meta.detailEtag = null
  meta.detailSyncedAt = null
  meta.detailSyncStatus = 'idle'
  meta.detailLastError = null
  if (meta.workItemsSyncedAt === null) {
    meta.visibility = 'unknown'
  }
  await writeMeta(owner, repo, reconcileMeta(meta))
}

/**
 * Invalidate shared work items cache.
 */
export async function invalidateSharedWorkItemsCache(owner: string, repo: string): Promise<void> {
  await storage().removeItem(workItemsKey(owner, repo))

  const meta = await readMeta(owner, repo)
  meta.workItemsSyncedAt = null
  meta.lastFullSyncAt = null
  meta.workItemsSyncStatus = 'idle'
  meta.workItemsLastError = null
  await writeMeta(owner, repo, reconcileMeta(meta))
}

interface RepoMetaEntry {
  owner: string
  repo: string
  meta: RepoSyncMeta
}

function parseOwnerRepoFromMetaKey(key: string): { owner: string, repo: string } | null {
  const match = /^shared-repo:([^~]+)~([^:]+):meta$/.exec(key)
  if (!match) return null
  const owner = match[1]
  const repo = match[2]
  if (!owner || !repo) return null
  return { owner, repo }
}

async function listKnownRepoMetaEntries(): Promise<RepoMetaEntry[]> {
  const keys = await storage().getKeys('shared-repo:')
  const entries = keys
    .map(parseOwnerRepoFromMetaKey)
    .filter((entry): entry is { owner: string, repo: string } => !!entry)

  const result: RepoMetaEntry[] = []
  for (const entry of entries) {
    const meta = await readMeta(entry.owner, entry.repo)
    result.push({ ...entry, meta })
  }

  return result
}

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

  const hasWorkItemsCache = Boolean(await readCache<WorkItem[]>(workItemsKey(owner, repo)))
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
