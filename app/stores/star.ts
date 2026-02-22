interface StarEntry {
  starred: boolean
  count: number
}

const DEBOUNCE_MS = 300
const PERSIST_TTL_MS = 15 * 60 * 1000 // 15 minutes

export const useStarStore = defineStore('star', () => {
  const entries = ref<Record<string, StarEntry>>({})
  const pending = ref<Record<string, boolean>>({})
  const loading = ref<Record<string, boolean>>({})
  const failed = ref<Record<string, boolean>>({})
  const persistedAt = ref<number>(0)

  // Debounced batch fetch
  let queued = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null

  function isExpired(): boolean {
    return !persistedAt.value || Date.now() - persistedAt.value > PERSIST_TTL_MS
  }

  function request(repo: string) {
    // If persisted data expired, treat all entries as stale
    if (isExpired() && Object.keys(entries.value).length) {
      entries.value = {}
      pending.value = {}
      loading.value = {}
      failed.value = {}
      persistedAt.value = 0
    }

    if (entries.value[repo] !== undefined) return
    queued.add(repo)
    if (!timer) {
      timer = setTimeout(() => {
        const batch = [...queued]
        queued = new Set()
        timer = null
        fetchBatch(batch)
      }, DEBOUNCE_MS)
    }
  }

  async function fetchBatch(repos: string[]) {
    const missing = repos.filter(r => entries.value[r] === undefined)
    if (!missing.length) return

    // Mark as loading
    const loadingUpdate: Record<string, boolean> = {}
    for (const r of missing) loadingUpdate[r] = true
    loading.value = { ...loading.value, ...loadingUpdate }

    try {
      const data = await $fetch<Record<string, StarEntry>>(
        '/api/repository/stars',
        { params: { repos: missing.join(',') } },
      )
      entries.value = { ...entries.value, ...data }
      persistedAt.value = Date.now()
      // Clear any previous failure flags for successfully fetched repos
      const failedClear: Record<string, boolean> = {}
      for (const r of missing) failedClear[r] = false
      failed.value = { ...failed.value, ...failedClear }
    }
    catch {
      // Mark failed repos so the button doesn't spin forever
      const failedUpdate: Record<string, boolean> = {}
      for (const r of missing) failedUpdate[r] = true
      failed.value = { ...failed.value, ...failedUpdate }
    }
    finally {
      const loadingClear: Record<string, boolean> = {}
      for (const r of missing) loadingClear[r] = false
      loading.value = { ...loading.value, ...loadingClear }
    }
  }

  async function toggleStar(repo: string) {
    const current = entries.value[repo]
    if (!current || pending.value[repo]) return

    const newStarred = !current.starred
    const oldCount = current.count

    // Optimistic update
    entries.value = {
      ...entries.value,
      [repo]: { starred: newStarred, count: oldCount + (newStarred ? 1 : -1) },
    }
    pending.value = { ...pending.value, [repo]: true }

    try {
      const result = await $fetch<{ viewerHasStarred: boolean, stargazerCount: number }>(
        '/api/repository/star',
        { method: 'PUT', body: { repo, starred: newStarred } },
      )
      entries.value = {
        ...entries.value,
        [repo]: { starred: result.viewerHasStarred, count: result.stargazerCount },
      }
      persistedAt.value = Date.now()
    }
    catch {
      entries.value = {
        ...entries.value,
        [repo]: { starred: current.starred, count: oldCount },
      }
    }
    finally {
      pending.value = { ...pending.value, [repo]: false }
    }
  }

  function isStarred(repo: string): boolean {
    return entries.value[repo]?.starred ?? false
  }

  function starCount(repo: string): number {
    return entries.value[repo]?.count ?? 0
  }

  function isLoaded(repo: string): boolean {
    return entries.value[repo] !== undefined
  }

  function isPending(repo: string): boolean {
    return pending.value[repo] ?? false
  }

  function isLoading(repo: string): boolean {
    return loading.value[repo] ?? false
  }

  function hasFailed(repo: string): boolean {
    return failed.value[repo] ?? false
  }

  return { entries, persistedAt, pending, loading, failed, request, toggleStar, isStarred, starCount, isLoaded, isPending, isLoading, hasFailed }
}, {
  persist: {
    pick: ['entries', 'persistedAt'],
  },
})
