import type { Repository, RepoActivity } from '~~/shared/types/repository'

export const useRepositoryStore = defineStore('repository', () => {
  const apiFetch = useRequestFetch()

  // --- State ---
  const repos = ref<Repository[]>([])
  const prCounts = ref<Record<string, number>>({})
  const issueCounts = ref<Record<string, number>>({})
  const notificationCounts = ref<Record<string, number>>({})
  const activity = ref<Record<string, RepoActivity>>({})
  const selectedOrg = ref<string | null>(null)
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
      const params = selectedOrg.value ? { org: selectedOrg.value } : undefined

      // Repos first (blocking — needed for the list)
      repos.value = await apiFetch<Repository[]>('/api/repository', { params })

      // Counts + activity in parallel (non-blocking enrichment, same org scope)
      const [counts, notifications, act] = await Promise.all([
        apiFetch<{ prCounts: Record<string, number>, issueCounts: Record<string, number> }>('/api/repository/counts', { params }),
        apiFetch<Record<string, number>>('/api/repository/notifications', { params }),
        apiFetch<Record<string, RepoActivity>>('/api/repository/activity', { params }),
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

  async function selectOrg(org: string | null) {
    selectedOrg.value = org
    loaded.value = false
    await fetchAll()
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
    selectedOrg,
    loaded,
    loading,
    errorKey,
    // Actions
    fetchAll,
    selectOrg,
    refresh,
  }
})
