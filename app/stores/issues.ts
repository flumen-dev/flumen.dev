import type { Issue } from '~~/shared/types/issue'

export type IssueSortKey = 'critical' | 'newest' | 'oldest' | 'mostCommented' | 'leastCommented' | 'recentlyUpdated'

function criticalScore(issue: Issue): number {
  let score = 0
  if (!issue.maintainerCommented) score += 15
  if (!issue.maintainerCommented && issue.commentCount > 0) score += issue.commentCount * 3
  score += issue.commentCount
  if (!issue.assignees.length) score += 8
  if (!issue.linkedPrCount) score += 5
  if (issue.milestone) score -= 2
  if (issue.linkedPrCount) score -= 3
  return score
}

export const useIssueStore = defineStore('issues', () => {
  const apiFetch = useRequestFetch()

  const selectedRepo = ref<string | null>(null)
  const loaded = ref(false)
  const errorKey = ref<string | null>(null)
  const stateFilter = ref<'open' | 'closed'>('open')
  const search = ref('')
  const sortKey = ref<IssueSortKey>('critical')
  const activeFilters = ref<string[]>([])

  // --- Server search ---
  const searchResults = ref<Issue[]>([])
  const searching = ref(false)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let searchRequestId = 0

  // --- Build server params from active filters ---
  function buildParams(): Record<string, string | number> {
    const p: Record<string, string | number> = {
      state: stateFilter.value,
      repo: selectedRepo.value!,
    }
    if (activeFilters.value.includes('assignedToMe')) p.assignedToMe = 1
    if (activeFilters.value.includes('unassigned')) p.unassigned = 1
    if (activeFilters.value.includes('hasMilestone')) p.milestone = '*'
    const labels = activeFilters.value.filter(f => f.startsWith('label:')).map(f => f.slice(6))
    if (labels.length) p.label = labels.join(',')
    return p
  }

  const section = usePaginatedSection<Issue>(
    apiFetch,
    '/api/issues',
    20,
    buildParams,
  )

  // --- Derived ---
  const availableLabels = computed(() => {
    const source = search.value ? searchResults.value : section.data.value
    if (!source.length) return []
    const set = new Set(source.flatMap(i => i.labels.map(l => l.name)))
    return [...set].sort()
  })

  const sortedIssues = computed(() => {
    const source = search.value ? searchResults.value : section.data.value
    const s = sortKey.value
    if (s === 'critical') return [...source].sort((a, b) => criticalScore(b) - criticalScore(a))
    if (s === 'newest') return [...source].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (s === 'oldest') return [...source].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    if (s === 'mostCommented') return [...source].sort((a, b) => b.commentCount - a.commentCount)
    if (s === 'leastCommented') return [...source].sort((a, b) => a.commentCount - b.commentCount)
    if (s === 'recentlyUpdated') return [...source].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return source
  })

  // --- Actions ---
  async function fetchIssues() {
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

  async function searchIssues(q: string) {
    if (!selectedRepo.value || !q.trim()) {
      searchResults.value = []
      searching.value = false
      return
    }
    const requestId = ++searchRequestId
    searching.value = true
    try {
      const results = await apiFetch<Issue[]>('/api/issues/search', {
        params: {
          repo: selectedRepo.value,
          state: stateFilter.value,
          q: q.trim(),
        },
      })
      if (requestId !== searchRequestId) return
      searchResults.value = results
    }
    catch {
      if (requestId !== searchRequestId) return
      searchResults.value = []
    }
    finally {
      if (requestId === searchRequestId) searching.value = false
    }
  }

  watch(search, (q) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    if (!q.trim()) {
      searchResults.value = []
      searching.value = false
      return
    }
    searching.value = true
    searchDebounceTimer = setTimeout(() => searchIssues(q), 300)
  })

  async function selectRepo(repo: string) {
    if (repo === selectedRepo.value && loaded.value) return
    selectedRepo.value = repo
    loaded.value = false
    search.value = ''
    searchResults.value = []
    await fetchIssues()
  }

  async function refresh() {
    loaded.value = false
    search.value = ''
    searchResults.value = []
    await fetchIssues()
  }

  return {
    issues: section.data,
    selectedRepo,
    loaded,
    loading: section.loading,
    errorKey,
    stateFilter,
    search,
    sortKey,
    activeFilters,
    totalCount: section.totalCount,
    hasMore: section.hasMore,
    currentPage: section.currentPage,
    totalPages: section.totalPages,
    hasPrevious: section.hasPrevious,
    paging: section.paging,
    searchResults,
    searching,
    availableLabels,
    sortedIssues,
    fetchIssues,
    loadNextPage: section.nextPage,
    loadPreviousPage: section.prevPage,
    selectRepo,
    refresh,
  }
})
