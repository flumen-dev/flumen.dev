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
const SYNC_LOCK_TTL_MS = 60_000 // 60 s

// In-memory dedup — prevents the same process from spawning two syncs
const activeSyncs = new Set<string>()

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
  }

  return reconcileMeta(meta)
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
  if (activeSyncs.has(key)) return false

  const existing = await storage().getItem<number>(key)
  if (existing && existing + SYNC_LOCK_TTL_MS > Date.now()) return false

  activeSyncs.add(key)
  await storage().setItem(key, Date.now(), { ttl: Math.ceil(SYNC_LOCK_TTL_MS / 1000) })
  return true
}

export async function releaseSyncLock(owner: string, repo: string, scope: string): Promise<void> {
  const key = syncLockKey(owner, repo, scope)
  activeSyncs.delete(key)
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
 * Matches the key format used by defineCachedFunction in [number].get.ts
 */
export async function invalidateIssueDetailCache(login: string, repo: string, issueNumber: number) {
  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) return
  const cacheKey = `nitro:functions:issue-detail:${login}:${owner}/${repoName}#${issueNumber}.json`
  await useStorage('cache').removeItem(cacheKey)
}

/**
 * Invalidate the server-side work item detail cache after mutations.
 * Matches the key format used by defineCachedFunction in work-items/[id].get.ts
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
