import type { WorkItem } from '~~/shared/types/work-item'

export const useWorkItemStore = defineStore('workItems', () => {
  const apiFetch = useRequestFetch()

  const selectedRepo = ref<string | null>(null)
  const loaded = ref(false)
  const errorKey = ref<string | null>(null)
  const stateFilter = ref<'open' | 'closed'>('open')
  const searchQuery = ref('')
  const assigneeFilter = ref('')
  const authorFilter = ref('')
  const labelFilter = ref('')
  const typeFilter = ref<'issue' | 'pr' | ''>('')

  function buildParams(): Record<string, string | number> {
    const params: Record<string, string | number> = {
      state: stateFilter.value,
      repo: selectedRepo.value!,
    }
    if (searchQuery.value) params.q = searchQuery.value
    if (assigneeFilter.value) params.assignee = assigneeFilter.value
    if (authorFilter.value) params.author = authorFilter.value
    if (labelFilter.value) params.label = labelFilter.value
    if (typeFilter.value) params.type = typeFilter.value
    return params
  }

  function clearFilters() {
    searchQuery.value = ''
    assigneeFilter.value = ''
    authorFilter.value = ''
    labelFilter.value = ''
    typeFilter.value = ''
    quickFilter.value = null
  }

  const hasActiveFilters = computed(() =>
    !!(searchQuery.value || assigneeFilter.value || authorFilter.value || labelFilter.value || typeFilter.value),
  )

  // Quick filter presets
  type QuickFilter = 'newest' | 'most-discussed' | 'stale' | 'needs-review' | 'my-items' | null
  const quickFilter = ref<QuickFilter>(null)

  // Presets that need the Search API set server-side filters
  function applyQuickFilter(filter: QuickFilter) {
    const wasActive = quickFilter.value === filter
    quickFilter.value = wasActive ? null : filter

    // Reset server filters before applying preset
    clearFilters()

    if (!wasActive) {
      const session = useUserSession()
      const login = session.user.value?.login

      switch (filter) {
        case 'stale':
          // Search API: updated before 30 days ago
          searchQuery.value = `updated:<${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
          break
        case 'needs-review':
          typeFilter.value = 'pr'
          searchQuery.value = 'review:required'
          break
        case 'my-items':
          if (login) searchQuery.value = `involves:${login}`
          break
      }
    }

    fetchWorkItems()
  }

  // Client-side sort for newest/most-discussed (no API needed)
  const quickFilteredItems = computed(() => {
    const items = sortedWorkItemsRaw.value
    if (!quickFilter.value) return items

    switch (quickFilter.value) {
      case 'newest':
        return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      case 'most-discussed':
        return [...items].sort((a, b) => b.commentCount - a.commentCount)
      default:
        return items
    }
  })

  const section = usePaginatedSection<WorkItem>(
    apiFetch,
    '/api/work-items',
    20,
    buildParams,
  )

  const sortedWorkItemsRaw = computed(() => {
    return [...section.data.value].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  })

  const sortedWorkItems = computed(() => quickFilteredItems.value)

  async function fetchWorkItems() {
    if (!selectedRepo.value) return
    errorKey.value = null
    await section.refresh()
    if (section.error.value) {
      errorKey.value = 'fetchError'
    }
    else {
      loaded.value = true
    }
  }

  async function selectRepo(repo: string) {
    if (repo === selectedRepo.value && loaded.value) return
    selectedRepo.value = repo
    loaded.value = false
    await fetchWorkItems()
  }

  async function refresh() {
    loaded.value = false
    await fetchWorkItems()
  }

  return {
    workItems: section.data,
    selectedRepo,
    loaded,
    loading: section.loading,
    errorKey,
    stateFilter,
    totalCount: section.totalCount,
    hasMore: section.hasMore,
    currentPage: section.currentPage,
    totalPages: section.totalPages,
    hasPrevious: section.hasPrevious,
    paging: section.paging,
    sortedWorkItems,
    searchQuery,
    assigneeFilter,
    authorFilter,
    labelFilter,
    typeFilter,
    hasActiveFilters,
    clearFilters,
    quickFilter,
    applyQuickFilter,
    fetchWorkItems,
    loadNextPage: section.nextPage,
    loadPreviousPage: section.prevPage,
    selectRepo,
    refresh,
  }
})
