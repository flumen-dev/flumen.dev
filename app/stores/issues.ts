import type { Issue } from '~~/shared/types/issue'

export const useIssueStore = defineStore('issues', () => {
  const apiFetch = useRequestFetch()

  // --- State ---
  const issues = ref<Issue[]>([])
  const selectedRepo = ref<string | null>(null)
  const loaded = ref(false)
  const loading = ref(false)
  const errorKey = ref<string | null>(null)
  const stateFilter = ref<'open' | 'closed'>('open')

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
  async function fetchIssues() {
    if (!selectedRepo.value) return
    loading.value = true
    errorKey.value = null
    try {
      issues.value = await apiFetch<Issue[]>('/api/issues', {
        params: { state: stateFilter.value, repo: selectedRepo.value },
      })
      loaded.value = true
    }
    catch (err) {
      handleError(err)
    }
    finally {
      loading.value = false
    }
  }

  async function selectRepo(repo: string) {
    if (repo === selectedRepo.value && loaded.value) return
    selectedRepo.value = repo
    loaded.value = false
    await fetchIssues()
  }

  async function refresh() {
    loaded.value = false
    await fetchIssues()
  }

  return {
    // State
    issues,
    selectedRepo,
    loaded,
    loading,
    errorKey,
    stateFilter,
    // Actions
    fetchIssues,
    selectRepo,
    refresh,
  }
})
