import type { Repository, RepoActivity, RepoPageResponse } from '~~/shared/types/repository'

export const useRepositoryStore = defineStore('repository', () => {
  const apiFetch = useRequestFetch()

  // --- Params ---
  const selectedOrg = ref<string | null>(null)
  const search = ref('')
  const sort = ref('pushed')
  const filters = ref<string[]>([])
  const languages = ref<string[]>([])

  // --- Enrichment state (extracted from response) ---
  const prCounts = ref<Record<string, number>>({})
  const issueCounts = ref<Record<string, number>>({})
  const notificationCounts = ref<Record<string, number>>({})
  const activity = ref<Record<string, RepoActivity>>({})
  const availableLanguages = ref<string[]>([])

  // --- Error handling ---
  const errorKey = ref<string | null>(null)

  function buildParams(): Record<string, string | number> {
    const p: Record<string, string | number> = {}
    if (selectedOrg.value) p.org = selectedOrg.value
    if (search.value.trim()) p.search = search.value.trim()
    if (sort.value !== 'pushed') p.sort = sort.value
    if (filters.value.length) p.filters = filters.value.join(',')
    if (languages.value.length) p.languages = languages.value.join(',')
    return p
  }

  function handleResponse(res: RepoPageResponse) {
    prCounts.value = res.prCounts
    issueCounts.value = res.issueCounts
    notificationCounts.value = res.notificationCounts
    activity.value = res.activity
    availableLanguages.value = res.availableLanguages
  }

  const section = usePaginatedSection<Repository, RepoPageResponse>(
    apiFetch,
    '/api/repository',
    20,
    buildParams,
    handleResponse,
  )

  // --- Error mapping ---
  watch(section.error, (hasError) => {
    if (!hasError) return
    errorKey.value = 'fetchError'
  })

  // --- Actions ---
  async function fetchRepos() {
    errorKey.value = null
    await section.refresh()
  }

  async function selectOrg(org: string | null) {
    if (org === selectedOrg.value) return
    selectedOrg.value = org
    section.resetPagination()
    await fetchRepos()
  }

  async function refresh() {
    await fetchRepos()
  }

  return {
    // Paginated section
    repos: section.data,
    loading: section.loading,
    totalCount: section.totalCount,
    hasMore: section.hasMore,
    hasPrevious: section.hasPrevious,
    currentPage: section.currentPage,
    totalPages: section.totalPages,
    paging: section.paging,
    nextPage: section.nextPage,
    prevPage: section.prevPage,
    resetPagination: section.resetPagination,
    fetch: section.fetch,
    isStale: section.isStale,

    // Enrichment
    prCounts,
    issueCounts,
    notificationCounts,
    activity,
    availableLanguages,

    // Params
    selectedOrg,
    search,
    sort,
    filters,
    languages,

    // Status
    errorKey,

    // Actions
    fetchRepos,
    selectOrg,
    refresh,
  }
})
