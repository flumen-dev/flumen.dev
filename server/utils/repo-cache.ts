import type { RepoDetail } from '~~/shared/types/repository'
import type { WorkItem } from '~~/shared/types/work-item'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RepoSyncMeta {
  visibility: 'unknown' | 'public' | 'private'
  lastRequestedAt: number
  lastSyncedAt: number | null
  detailSyncedAt: number | null
  detailSyncStartedAt: number | null
  lastFullSyncAt: number | null
  detailSyncStatus: 'idle' | 'running' | 'failed'
  workItemsSyncStatus: 'idle' | 'running' | 'failed'
  workItemsSyncStartedAt: number | null
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

export interface SharedCacheEntry<T> {
  data: T
  fetchedAt: number
}

export interface RepoMetaEntry {
  owner: string
  repo: string
  meta: RepoSyncMeta
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export const SYNC_LOCK_TTL_MS = 5 * 60_000 // 5 min
const SYNC_STATUS_STUCK_MS = 10 * 60_000 // 10 min

// ---------------------------------------------------------------------------
// Storage key helpers
// ---------------------------------------------------------------------------
function metaKey(owner: string, repo: string): string {
  return `shared-repo:${owner}~${repo}:meta`
}

export function detailKey(owner: string, repo: string): string {
  return `shared-repo:${owner}~${repo}:detail`
}

export function workItemsKey(owner: string, repo: string): string {
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

function freshMeta(): RepoSyncMeta {
  return {
    visibility: 'unknown',
    lastRequestedAt: 0,
    lastSyncedAt: null,
    detailSyncedAt: null,
    detailSyncStartedAt: null,
    lastFullSyncAt: null,
    detailSyncStatus: 'idle',
    workItemsSyncStatus: 'idle',
    workItemsSyncStartedAt: null,
    requestCount: 0,
    detailLastError: null,
    workItemsLastError: null,
    detailEtag: null,
    workItemsSyncedAt: null,
  }
}

function isRunningStatusStuck(status: 'idle' | 'running' | 'failed', startedAt: number | null, syncedAt: number | null): boolean {
  if (status !== 'running') return false
  const referenceAt = startedAt ?? syncedAt
  if (!referenceAt) return true
  return Date.now() - referenceAt > SYNC_STATUS_STUCK_MS
}

function recoverStuckStatuses(meta: RepoSyncMeta): { meta: RepoSyncMeta, changed: boolean } {
  let changed = false
  const next = { ...meta }

  if (isRunningStatusStuck(next.detailSyncStatus, next.detailSyncStartedAt, next.detailSyncedAt)) {
    next.detailSyncStatus = 'idle'
    next.detailSyncStartedAt = null
    changed = true
  }

  if (isRunningStatusStuck(next.workItemsSyncStatus, next.workItemsSyncStartedAt, next.workItemsSyncedAt)) {
    next.workItemsSyncStatus = 'idle'
    next.workItemsSyncStartedAt = null
    changed = true
  }

  return { meta: next, changed }
}

export function reconcileMeta(meta: RepoSyncMeta): RepoSyncMeta {
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

// ---------------------------------------------------------------------------
// Meta CRUD
// ---------------------------------------------------------------------------
export async function readMeta(owner: string, repo: string): Promise<RepoSyncMeta> {
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
    detailSyncStartedAt: existing.detailSyncStartedAt ?? null,
    workItemsSyncedAt: existing.workItemsSyncedAt ?? null,
    workItemsSyncStartedAt: existing.workItemsSyncStartedAt ?? null,
  }

  const reconciled = reconcileMeta(meta)
  const detailReferenceAt = reconciled.detailSyncStartedAt ?? reconciled.detailSyncedAt
  const workItemsReferenceAt = reconciled.workItemsSyncStartedAt ?? reconciled.workItemsSyncedAt
  const detailWasStuck = isRunningStatusStuck(
    reconciled.detailSyncStatus,
    reconciled.detailSyncStartedAt,
    reconciled.detailSyncedAt,
  )
  const workItemsWasStuck = isRunningStatusStuck(
    reconciled.workItemsSyncStatus,
    reconciled.workItemsSyncStartedAt,
    reconciled.workItemsSyncedAt,
  )
  const recovered = recoverStuckStatuses(reconciled)
  if (recovered.changed) {
    console.warn('[repo-cache] recovered stuck sync status', {
      owner,
      repo,
      detailWasStuck,
      workItemsWasStuck,
      detailStuckSince: detailReferenceAt,
      workItemsStuckSince: workItemsReferenceAt,
      detailStuckForMs: detailReferenceAt ? Date.now() - detailReferenceAt : null,
      workItemsStuckForMs: workItemsReferenceAt ? Date.now() - workItemsReferenceAt : null,
    })
    await storage().setItem(metaKey(owner, repo), recovered.meta)
  }

  return recovered.meta
}

export async function writeMeta(owner: string, repo: string, meta: RepoSyncMeta): Promise<void> {
  await storage().setItem(metaKey(owner, repo), meta)
}

// ---------------------------------------------------------------------------
// Cache read / write
// ---------------------------------------------------------------------------
export async function readCache<T>(key: string): Promise<SharedCacheEntry<T> | null> {
  return storage().getItem<SharedCacheEntry<T>>(key)
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  await storage().setItem(key, { data, fetchedAt: Date.now() } satisfies SharedCacheEntry<T>)
}

// Typed convenience accessors
export function readRepoDetail(owner: string, repo: string) {
  return readCache<RepoDetail>(detailKey(owner, repo))
}

export function writeRepoDetail(owner: string, repo: string, detail: RepoDetail) {
  return writeCache(detailKey(owner, repo), detail)
}

export function readWorkItems(owner: string, repo: string) {
  return readCache<WorkItem[]>(workItemsKey(owner, repo))
}

export function writeWorkItems(owner: string, repo: string, items: WorkItem[]) {
  return writeCache(workItemsKey(owner, repo), items)
}

// ---------------------------------------------------------------------------
// Sync lock with TTL
// ---------------------------------------------------------------------------
export async function acquireSyncLock(owner: string, repo: string, scope: string): Promise<boolean> {
  const key = syncLockKey(owner, repo, scope)

  const existing = await storage().getItem<number>(key)
  if (existing && existing + SYNC_LOCK_TTL_MS > Date.now()) {
    console.warn('[repo-cache] sync lock blocked', {
      owner,
      repo,
      scope,
      storageLockActive: true,
      existingLockAge: Date.now() - existing,
    })
    return false
  }

  // Storage lock is intentionally the only dedup source for serverless runtimes.
  // There is still a small TOCTOU race between read and set that can duplicate work.
  await storage().setItem(key, Date.now(), { ttl: Math.ceil(SYNC_LOCK_TTL_MS / 1000) })
  return true
}

export async function releaseSyncLock(owner: string, repo: string, scope: string): Promise<void> {
  const key = syncLockKey(owner, repo, scope)
  await storage().removeItem(key)
}

// ---------------------------------------------------------------------------
// Activity tracking
// ---------------------------------------------------------------------------
export async function touchActivity(owner: string, repo: string): Promise<void> {
  const meta = await readMeta(owner, repo)
  meta.lastRequestedAt = Date.now()
  meta.requestCount += 1
  await writeMeta(owner, repo, meta)
}

// ---------------------------------------------------------------------------
// Staleness decisions
// ---------------------------------------------------------------------------
export function isStale(fetchedAt: number | null, staleMs: number): boolean {
  if (!fetchedAt) return true
  return Date.now() - fetchedAt > staleMs
}

export function isVeryOld(fetchedAt: number | null, veryOldMs: number): boolean {
  if (!fetchedAt) return true
  return Date.now() - fetchedAt > veryOldMs
}

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

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

/**
 * Invalidate the server-side issue detail cache after mutations.
 * Matches the key format used by defineCachedFunction in [number].get.ts.
 * Verified against Nitro v2.11 key prefixing; this may require updates on Nitro upgrades.
 */
export async function invalidateIssueDetailCache(login: string, repo: string, issueNumber: number) {
  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) return
  const cacheKey = `nitro:functions:issue-detail:${login}:${owner}/${repoName}#${issueNumber}.json`
  await useStorage('cache').removeItem(cacheKey)
}

/**
 * Invalidate the server-side work item detail cache after mutations.
 * Matches the key format used by defineCachedFunction in work-items/[id].get.ts.
 * Verified against Nitro v2.11 key prefixing; this may require updates on Nitro upgrades.
 */
export async function invalidateWorkItemDetailCache(login: string, owner: string, repo: string, id: string) {
  const cacheKey = `nitro:functions:repo-work-item-detail:${login}:${owner}/${repo}:${id}.json`
  await useStorage('cache').removeItem(cacheKey)
}

// ---------------------------------------------------------------------------
// Meta listing
// ---------------------------------------------------------------------------
function parseOwnerRepoFromMetaKey(key: string): { owner: string, repo: string } | null {
  const match = /^shared-repo:([^~]+)~([^:]+):meta$/.exec(key)
  if (!match) return null
  const owner = match[1]
  const repo = match[2]
  if (!owner || !repo) return null
  return { owner, repo }
}

export async function listKnownRepoMetaEntries(): Promise<RepoMetaEntry[]> {
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
