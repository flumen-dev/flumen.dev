import type { Repository, RepoActivity } from '~~/shared/types/repository'

export const useRepositoryStore = defineStore('repository', () => {
  const apiFetch = useRequestFetch()

  // --- State ---
  const repos = ref<Repository[]>([])
  const prCounts = ref<Record<string, number>>({})
  const issueCounts = ref<Record<string, number>>({})
  const notificationCounts = ref<Record<string, number>>({})
  const activity = ref<Record<string, RepoActivity>>({})
  const loaded = ref(false)
  const loading = ref(false)
  const errorKey = ref<string | null>(null)

  // --- Error handler ---
  function handleError(err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 401) {
      errorKey.value = 'sessionExpired'
    }
    else if (status === 403) {
      errorKey.value = 'rateLimited'
    }
    else {
      errorKey.value = 'fetchError'
    }
  }

  // --- Actions ---
  async function fetchAll() {
    if (loaded.value) return
    loading.value = true
    errorKey.value = null
    try {
      // Repos first (blocking — needed for the list)
      repos.value = await apiFetch<Repository[]>('/api/repository')

      // Counts + activity in parallel (non-blocking enrichment)
      const [counts, notifications, act] = await Promise.all([
        apiFetch<{ prCounts: Record<string, number>, issueCounts: Record<string, number> }>('/api/repository/counts'),
        apiFetch<Record<string, number>>('/api/repository/notifications'),
        apiFetch<Record<string, RepoActivity>>('/api/repository/activity'),
      ])
      prCounts.value = counts.prCounts
      issueCounts.value = counts.issueCounts
      notificationCounts.value = notifications
      activity.value = act

      loaded.value = true
    }
    catch (err) {
      handleError(err)
    }
    finally {
      loading.value = false
    }
  }

  async function refresh() {
    loaded.value = false
    await fetchAll()
  }

  return {
    // State
    repos,
    prCounts,
    issueCounts,
    notificationCounts,
    activity,
    loaded,
    loading,
    errorKey,
    // Actions
    fetchAll,
    refresh,
  }
})
