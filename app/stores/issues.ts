import type { Issue } from '~~/shared/types/issue'

export type IssueSortKey = 'critical' | 'newest' | 'oldest' | 'mostCommented' | 'leastCommented' | 'recentlyUpdated'

const HIGHLIGHT_PAGE_SIZE = HIGHLIGHT_CARD_VISIBLE_ITEMS

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
  const { user } = useUserSession()

  const selectedRepo = ref<string | null>(null)
  const loaded = ref(false)
  const errorKey = ref<string | null>(null)
  const stateFilter = ref<'open' | 'closed'>('open')
  const search = ref('')
  const sortKey = ref<IssueSortKey>('critical')
  const activeFilters = ref<string[]>([])

  // Cached counts per state so both open/closed totals stay visible across switches.
  const openCount = ref<number | null>(null)
  const closedCount = ref<number | null>(null)

  // Repo-wide people pool (sampled across recent issues, server-cached).
  // Used by the author/assignee filter pickers — broader than the first 20 loaded issues.
  interface RepoPerson { login: string, avatarUrl: string, name?: string | null, count: number }
  const repoAuthors = ref<RepoPerson[]>([])
  const repoAssignees = ref<RepoPerson[]>([])

  const EXCLUSIVE_FILTERS = ['assignedToMe', 'unassigned']

  const hasActiveFilters = computed(() =>
    search.value.trim().length > 0 || activeFilters.value.length > 0,
  )

  // Debounced refetch so rapid filter toggles collapse into a single request.
  const refetchAfterFilterChange = useDebounceFn(() => {
    fetchIssues()
    if (search.value.trim()) searchIssues(search.value)
  }, 200)

  function toggleFilter(key: string) {
    let current = activeFilters.value
    if (current.includes(key)) {
      activeFilters.value = current.filter(f => f !== key)
    }
    else {
      // Mutually exclusive: enabling assignedToMe/unassigned disables the pair
      // AND any specific assignee:* picker.
      if (EXCLUSIVE_FILTERS.includes(key)) {
        current = current.filter(f =>
          !EXCLUSIVE_FILTERS.includes(f) && !f.startsWith('assignee:'),
        )
      }
      activeFilters.value = [...current, key]
    }
    refetchAfterFilterChange()
  }

  /**
   * Set a single-value filter under a given prefix (e.g. `author`, `assignee`).
   * Pass `value === null` to clear it. Replaces any existing filter for that prefix.
   * For `assignee`, also clears the assignedToMe/unassigned pair.
   */
  function setUniqueFilter(prefix: 'author' | 'assignee', value: string | null) {
    let next = activeFilters.value.filter(f => !f.startsWith(`${prefix}:`))
    if (prefix === 'assignee') {
      next = next.filter(f => !EXCLUSIVE_FILTERS.includes(f))
    }
    if (value) next = [...next, `${prefix}:${value}`]
    if (next.length === activeFilters.value.length
      && next.every((v, i) => v === activeFilters.value[i])) return
    activeFilters.value = next
    refetchAfterFilterChange()
  }

  function clearFilters() {
    if (!hasActiveFilters.value) return
    activeFilters.value = []
    search.value = ''
    refetchAfterFilterChange()
  }

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
    const author = activeFilters.value.find(f => f.startsWith('author:'))?.slice(7)
    if (author) p.author = author
    const assignee = activeFilters.value.find(f => f.startsWith('assignee:'))?.slice(9)
    if (assignee) p.assignee = assignee
    return p
  }

  const section = usePaginatedSection<Issue>(
    apiFetch,
    '/api/issues',
    20,
    buildParams,
  )

  // Highlight cards — three independent server queries, paginated independently.
  const highlightParams = () => ({ repo: selectedRepo.value ?? '' })
  const assignedToMe = usePaginatedSection<Issue>(apiFetch, '/api/issues/assigned-to-me', HIGHLIGHT_PAGE_SIZE, highlightParams)
  const mentioned = usePaginatedSection<Issue>(apiFetch, '/api/issues/mentioned', HIGHLIGHT_PAGE_SIZE, highlightParams)
  const authoredByMe = usePaginatedSection<Issue>(apiFetch, '/api/issues/authored-by-me', HIGHLIGHT_PAGE_SIZE, highlightParams)

  // --- Derived ---

  // Layer 1 of magical-search (#277): instant ranking over already-loaded issues
  // so the user sees relevance signals before the server search returns.
  const clientFuzzyResults = computed<Issue[]>(() => {
    const q = search.value.trim()
    if (!q) return []
    return rankIssues(section.data.value, q, user.value?.login ?? null)
  })

  // When search is active, merge instant client matches with the server's broader
  // recall, deduped by id, client-first so the most likely hit lands at the top.
  const mergedSearchResults = computed<Issue[]>(() => {
    if (!search.value.trim()) return []
    const seen = new Set<string>()
    const out: Issue[] = []
    for (const issue of clientFuzzyResults.value) {
      if (seen.has(issue.id)) continue
      seen.add(issue.id)
      out.push(issue)
    }
    for (const issue of searchResults.value) {
      if (seen.has(issue.id)) continue
      seen.add(issue.id)
      out.push(issue)
    }
    return out
  })

  const availableLabels = computed(() => {
    const source = search.value.trim() ? mergedSearchResults.value : section.data.value
    if (!source.length) return []
    const set = new Set(source.flatMap(i => i.labels.map(l => l.name)))
    return [...set].sort()
  })

  const sortedIssues = computed(() => {
    // Search-mode keeps the relevance order from rankIssues — sortKey doesn't
    // override it, otherwise the magical-search ranking would be discarded.
    if (search.value.trim()) return mergedSearchResults.value
    const source = section.data.value
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
  async function fetchHighlights() {
    if (!selectedRepo.value) return
    // Highlights only make sense for the open state.
    if (stateFilter.value !== 'open') {
      assignedToMe.resetPagination()
      mentioned.resetPagination()
      authoredByMe.resetPagination()
      return
    }
    await Promise.all([assignedToMe.refresh(), mentioned.refresh(), authoredByMe.refresh()])
  }

  async function fetchOtherCount() {
    if (!selectedRepo.value) return
    const otherState = stateFilter.value === 'open' ? 'closed' : 'open'
    const cachedRef = otherState === 'open' ? openCount : closedCount
    if (cachedRef.value != null) return
    try {
      const data = await apiFetch<PaginatedResponse<Issue>>('/api/issues', {
        params: { state: otherState, repo: selectedRepo.value, first: 1 },
      })
      cachedRef.value = data.totalCount
    }
    catch {
      // Count is best-effort; UI hides it when null.
    }
  }

  async function fetchIssues() {
    if (!selectedRepo.value) return
    errorKey.value = null
    await Promise.all([section.refresh(), fetchOtherCount(), fetchHighlights()])
    if (section.error.value) {
      errorKey.value = 'fetchError'
      return
    }
    // Update the active state's count from the just-fetched response.
    if (stateFilter.value === 'open') openCount.value = section.totalCount.value
    else closedCount.value = section.totalCount.value
    loaded.value = true
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
      const params: Record<string, string | number> = {
        repo: selectedRepo.value,
        state: stateFilter.value,
        q: q.trim(),
      }
      // Compose active filters with the search term so search runs *within* the filter set.
      if (activeFilters.value.includes('assignedToMe')) params.assignedToMe = 1
      if (activeFilters.value.includes('unassigned')) params.unassigned = 1
      if (activeFilters.value.includes('hasMilestone')) params.milestone = '*'
      const labels = activeFilters.value.filter(f => f.startsWith('label:')).map(f => f.slice(6))
      if (labels.length) params.label = labels.join(',')
      const author = activeFilters.value.find(f => f.startsWith('author:'))?.slice(7)
      if (author) params.author = author
      const assignee = activeFilters.value.find(f => f.startsWith('assignee:'))?.slice(9)
      if (assignee) params.assignee = assignee

      const results = await apiFetch<Issue[]>('/api/issues/search', { params })
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

  async function fetchPeoplePool() {
    if (!selectedRepo.value) return
    const [owner, name] = selectedRepo.value.split('/')
    if (!owner || !name) return
    try {
      const data = await apiFetch<{ authors: RepoPerson[], assignees: RepoPerson[] }>(
        `/api/repository/${owner}/${name}/issue-people`,
      )
      repoAuthors.value = data.authors
      repoAssignees.value = data.assignees
    }
    catch {
      // Best-effort — FilterBar falls back to the in-view derived pool.
      repoAuthors.value = []
      repoAssignees.value = []
    }
  }

  async function selectRepo(repo: string) {
    if (repo === selectedRepo.value && loaded.value) return
    selectedRepo.value = repo
    loaded.value = false
    search.value = ''
    searchResults.value = []
    openCount.value = null
    closedCount.value = null
    repoAuthors.value = []
    repoAssignees.value = []
    assignedToMe.resetPagination()
    mentioned.resetPagination()
    authoredByMe.resetPagination()
    await Promise.all([fetchIssues(), fetchPeoplePool()])
  }

  function updateIssue(repo: string, number: number, patch: Partial<Issue>) {
    const idx = section.data.value.findIndex(i => i.repository.nameWithOwner === repo && i.number === number)
    if (idx !== -1) {
      section.data.value = section.data.value.map((item, i) =>
        i === idx ? { ...item, ...patch } : item,
      )
    }
  }

  async function refresh() {
    loaded.value = false
    search.value = ''
    searchResults.value = []
    openCount.value = null
    closedCount.value = null
    assignedToMe.resetPagination()
    mentioned.resetPagination()
    authoredByMe.resetPagination()
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
    hasActiveFilters,
    toggleFilter,
    setUniqueFilter,
    clearFilters,
    repoAuthors,
    repoAssignees,
    openCount,
    closedCount,
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
    assignedToMe,
    mentioned,
    authoredByMe,
    fetchIssues,
    fetchHighlights,
    loadNextPage: section.nextPage,
    loadPreviousPage: section.prevPage,
    selectRepo,
    refresh,
    updateIssue,
  }
})
