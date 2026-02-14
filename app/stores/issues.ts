import type { Issue, PaginatedIssues } from '~~/shared/types/issue'

export type IssueSortKey = 'critical' | 'newest' | 'oldest' | 'mostCommented' | 'leastCommented' | 'recentlyUpdated'

/**
 * Critical score: higher = needs more maintainer attention.
 * - No maintainer comment + community activity = highest priority
 * - Unassigned = nobody handling it
 * - No linked PR = no fix in progress
 * - Has milestone = tracked, slightly less urgent
 * - Assigned / has PR = someone is on it → score drops
 */
function criticalScore(issue: Issue): number {
  let score = 0

  // Community is talking but maintainer hasn't responded — top priority
  if (!issue.maintainerCommented) score += 15
  if (!issue.maintainerCommented && issue.commentCount > 0) score += issue.commentCount * 3

  // General community interest
  score += issue.commentCount

  // Nobody assigned → needs attention
  if (!issue.assignees.length) score += 8

  // No PR linked → no fix in progress
  if (!issue.linkedPrCount) score += 5

  // Has milestone → at least tracked, slightly lower urgency
  if (issue.milestone) score -= 2

  // Has PR → someone working on it
  if (issue.linkedPrCount) score -= 3

  return score
}

export const useIssueStore = defineStore('issues', () => {
  const apiFetch = useRequestFetch()

  // --- State ---
  const issues = ref<Issue[]>([])
  const selectedRepo = ref<string | null>(null)
  const loaded = ref(false)
  const loading = ref(false)
  const errorKey = ref<string | null>(null)
  const stateFilter = ref<'open' | 'closed'>('open')
  const search = ref('')
  const sortKey = ref<IssueSortKey>('critical')
  const activeFilters = ref<string[]>([])

  // --- Pagination ---
  const totalCount = ref(0)
  const endCursor = ref<string | null>(null)
  const hasMore = ref(false)
  const cursorHistory = ref<string[]>([])

  // --- Page navigation direction (for button loading indicators) ---
  const paging = ref<'next' | 'prev' | null>(null)

  // --- Server search ---
  const searchResults = ref<Issue[]>([])
  const searching = ref(false)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let searchRequestId = 0

  // --- Derived ---
  const availableLabels = computed(() => {
    const source = search.value ? searchResults.value : issues.value
    if (!source.length) return []
    const set = new Set(source.flatMap(i => i.labels.map(l => l.name)))
    return [...set].sort()
  })

  const filteredIssues = computed(() => {
    // When searching, use server-side results
    let result = search.value ? searchResults.value : issues.value

    // Filters (applied to both local and search results)
    if (activeFilters.value.includes('unassigned')) {
      result = result.filter(i => !i.assignees.length)
    }
    if (activeFilters.value.includes('hasLinkedPr')) {
      result = result.filter(i => i.linkedPrCount > 0)
    }
    if (activeFilters.value.includes('noLinkedPr')) {
      result = result.filter(i => !i.linkedPrCount)
    }
    if (activeFilters.value.includes('hasMilestone')) {
      result = result.filter(i => i.milestone)
    }

    // Label filters (AND)
    const labelFilters = activeFilters.value.filter(f => f.startsWith('label:')).map(f => f.slice(6))
    if (labelFilters.length) {
      result = result.filter(i => labelFilters.every(l => i.labels.some(il => il.name === l)))
    }

    // Sort
    const s = sortKey.value
    if (s === 'critical') {
      result = [...result].sort((a, b) => criticalScore(b) - criticalScore(a))
    }
    else if (s === 'newest') {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    else if (s === 'oldest') {
      result = [...result].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }
    else if (s === 'mostCommented') {
      result = [...result].sort((a, b) => b.commentCount - a.commentCount)
    }
    else if (s === 'leastCommented') {
      result = [...result].sort((a, b) => a.commentCount - b.commentCount)
    }
    else if (s === 'recentlyUpdated') {
      result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return result
  })

  const PAGE_SIZE = 30
  const currentPage = computed(() => cursorHistory.value.length + 1)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)))
  const hasPrevious = computed(() => cursorHistory.value.length > 0)

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
    // Reset pagination
    endCursor.value = null
    hasMore.value = false
    cursorHistory.value = []
    try {
      const data = await apiFetch<PaginatedIssues>('/api/issues', {
        params: { state: stateFilter.value, repo: selectedRepo.value },
      })
      issues.value = data.issues
      totalCount.value = data.totalCount
      hasMore.value = data.pageInfo.hasNextPage
      endCursor.value = data.pageInfo.endCursor
      loaded.value = true
    }
    catch (err) {
      handleError(err)
    }
    finally {
      loading.value = false
    }
  }

  async function loadNextPage() {
    if (!selectedRepo.value || !hasMore.value || !endCursor.value || loading.value) return
    loading.value = true
    paging.value = 'next'
    errorKey.value = null
    try {
      cursorHistory.value = [...cursorHistory.value, endCursor.value]
      const data = await apiFetch<PaginatedIssues>('/api/issues', {
        params: {
          state: stateFilter.value,
          repo: selectedRepo.value,
          after: endCursor.value,
        },
      })
      issues.value = data.issues
      totalCount.value = data.totalCount
      hasMore.value = data.pageInfo.hasNextPage
      endCursor.value = data.pageInfo.endCursor
    }
    catch (err) {
      cursorHistory.value = cursorHistory.value.slice(0, -1)
      handleError(err)
    }
    finally {
      loading.value = false
      paging.value = null
    }
  }

  async function loadPreviousPage() {
    if (!selectedRepo.value || !cursorHistory.value.length || loading.value) return
    loading.value = true
    paging.value = 'prev'
    errorKey.value = null
    try {
      const history = [...cursorHistory.value]
      history.pop()
      const after = history.length ? history[history.length - 1] : undefined

      const params: Record<string, string> = {
        state: stateFilter.value,
        repo: selectedRepo.value,
      }
      if (after) params.after = after

      const data = await apiFetch<PaginatedIssues>('/api/issues', { params })
      issues.value = data.issues
      totalCount.value = data.totalCount
      hasMore.value = data.pageInfo.hasNextPage
      endCursor.value = data.pageInfo.endCursor
      cursorHistory.value = history
    }
    catch (err) {
      handleError(err)
    }
    finally {
      loading.value = false
      paging.value = null
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
      if (requestId !== searchRequestId) return // stale response
      searchResults.value = results
    }
    catch {
      if (requestId !== searchRequestId) return
      searchResults.value = []
    }
    finally {
      if (requestId === searchRequestId) {
        searching.value = false
      }
    }
  }

  // Debounced search watcher
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
    // State
    issues,
    selectedRepo,
    loaded,
    loading,
    errorKey,
    stateFilter,
    search,
    sortKey,
    activeFilters,
    // Pagination
    totalCount,
    hasMore,
    currentPage,
    totalPages,
    hasPrevious,
    paging,
    // Search
    searchResults,
    searching,
    // Derived
    availableLabels,
    filteredIssues,
    // Actions
    fetchIssues,
    loadNextPage,
    loadPreviousPage,
    selectRepo,
    refresh,
  }
})
