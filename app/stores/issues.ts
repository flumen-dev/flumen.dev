import type { Issue } from '~~/shared/types/issue'
import type { IssueDetail } from '~~/shared/types/issue-detail'

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
  const issue = ref<IssueDetail>()
  const selectedRepo = ref<string | null>(null)
  const loaded = ref(false)
  const loading = ref(false)
  const errorKey = ref<string | null>(null)
  const stateFilter = ref<'open' | 'closed'>('open')
  const search = ref('')
  const sortKey = ref<IssueSortKey>('critical')
  const activeFilters = ref<string[]>([])

  // --- Derived ---
  const availableLabels = computed(() => {
    if (!issues.value.length) return []
    const set = new Set(issues.value.flatMap(i => i.labels.map(l => l.name)))
    return [...set].sort()
  })

  const filteredIssues = computed(() => {
    let result = issues.value

    // Search
    if (search.value) {
      const q = search.value.toLowerCase()
      result = result.filter(i =>
        i.title.toLowerCase().includes(q)
        || `#${i.number}`.includes(q)
        || i.labels.some(l => l.name.toLowerCase().includes(q)),
      )
    }

    // Filters
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

  async function fetchIssue(id: number) {
    loading.value = true
    errorKey.value = null
    try {
      issue.value = await apiFetch<IssueDetail>(`/api/issues/:number/${id}`)
      console.log('Issue', issue.value)
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
    search,
    sortKey,
    activeFilters,
    // Derived
    availableLabels,
    filteredIssues,
    // Actions
    fetchIssues,
    fetchIssue,
    selectRepo,
    refresh,
  }
})
