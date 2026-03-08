import type { WorkItem } from '~~/shared/types/work-item'

export const useWorkItemStore = defineStore('workItems', () => {
  const apiFetch = useRequestFetch()

  const selectedRepo = ref<string | null>(null)
  const loaded = ref(false)
  const errorKey = ref<string | null>(null)
  const stateFilter = ref<'open' | 'closed'>('open')

  function buildParams(): Record<string, string | number> {
    return {
      state: stateFilter.value,
      repo: selectedRepo.value!,
    }
  }

  const section = usePaginatedSection<WorkItem>(
    apiFetch,
    '/api/work-items',
    20,
    buildParams,
  )

  const sortedWorkItems = computed(() => {
    return [...section.data.value].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  })

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
    fetchWorkItems,
    loadNextPage: section.nextPage,
    loadPreviousPage: section.prevPage,
    selectRepo,
    refresh,
  }
})
