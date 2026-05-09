import type { PullRequest, PullRequestListResponse } from '~~/shared/types/pull-request'

export type PrStateFilter = 'open' | 'closed' | 'merged'

interface FetchOptions {
  refresh?: boolean
}

const PAGE_SIZE = 20
const HIGHLIGHT_PAGE_SIZE = HIGHLIGHT_CARD_VISIBLE_ITEMS

/**
 * Internal helper — owns paginated state for a single highlight card
 * (ready-to-merge, reviews-requested). Mirrors the cursor-stack pattern from
 * the issue store.
 */
function createHighlightSection(endpoint: string, pageSize: number) {
  const apiFetch = useRequestFetch()

  const items = shallowRef<PullRequest[]>([])
  const totalCount = ref<number | null>(null)
  const cursorStack = ref<(string | null)[]>([null])
  const nextCursor = ref<string | null>(null)
  const hasMore = ref(false)
  const loading = ref(false)
  const paging = ref<'next' | 'prev' | null>(null)

  const currentPage = computed(() => Math.max(1, cursorStack.value.length))
  const hasPrevious = computed(() => currentPage.value > 1)
  const totalPages = computed(() => {
    if (totalCount.value === null) return 1
    return Math.max(1, Math.ceil(totalCount.value / pageSize))
  })

  function reset() {
    items.value = []
    totalCount.value = null
    cursorStack.value = [null]
    nextCursor.value = null
    hasMore.value = false
  }

  // Monotonic request id — only the most recent fetch is allowed to mutate
  // observable state. Protects against stale responses winning when the user
  // switches repos / pages quickly.
  let fetchSeq = 0

  async function fetchPage(repo: string) {
    const id = ++fetchSeq
    loading.value = true
    try {
      const after = cursorStack.value[cursorStack.value.length - 1]
      const response = await apiFetch<PullRequestListResponse>(endpoint, {
        params: { repo, first: pageSize, after: after ?? undefined },
      })
      if (id !== fetchSeq) return
      items.value = response.items
      totalCount.value = response.totalCount
      hasMore.value = response.pageInfo.hasNextPage
      nextCursor.value = response.pageInfo.endCursor
    }
    catch {
      if (id !== fetchSeq) return
      // Highlights are an enhancement — fail silently, leave empty.
      reset()
    }
    finally {
      if (id === fetchSeq) loading.value = false
    }
  }

  async function loadNext(repo: string) {
    if (!hasMore.value || paging.value || !nextCursor.value) return
    paging.value = 'next'
    try {
      cursorStack.value.push(nextCursor.value)
      await fetchPage(repo)
    }
    finally {
      paging.value = null
    }
  }

  async function loadPrevious(repo: string) {
    if (!hasPrevious.value || paging.value) return
    paging.value = 'prev'
    try {
      cursorStack.value.pop()
      await fetchPage(repo)
    }
    finally {
      paging.value = null
    }
  }

  return {
    items,
    totalCount,
    hasMore,
    hasPrevious,
    paging,
    loading,
    currentPage,
    totalPages,
    fetchPage,
    loadNext,
    loadPrevious,
    reset,
  }
}

export const usePullRequestStore = defineStore('pullRequests', () => {
  const apiFetch = useRequestFetch()

  const selectedRepo = ref<string | null>(null)
  const prs = shallowRef<PullRequest[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const errorKey = ref<string | null>(null)

  const stateFilter = ref<PrStateFilter>('open')

  const totalCount = ref<number | null>(null)
  const cursorStack = ref<(string | null)[]>([null])
  const nextCursor = ref<string | null>(null)
  const hasMore = ref(false)
  const paging = ref<'next' | 'prev' | null>(null)

  const readyToMerge = createHighlightSection('/api/pull-requests/ready-to-merge', HIGHLIGHT_PAGE_SIZE)
  const reviewsRequested = createHighlightSection('/api/pull-requests/reviews-requested', HIGHLIGHT_PAGE_SIZE)

  const currentPage = computed(() => Math.max(1, cursorStack.value.length))
  const hasPrevious = computed(() => currentPage.value > 1)
  const totalPages = computed(() => {
    if (totalCount.value === null) return 1
    return Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE))
  })

  function mapErrorKey(err: unknown): string {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 401) return 'sessionExpired'
    if (status === 403) return 'rateLimited'
    if (status === 404) return 'notFound'
    return 'generic'
  }

  // Monotonic request id for the main list — protects against stale responses
  // overwriting newer state on rapid repo / state switches.
  let fetchPrsSeq = 0

  async function fetchPrs(opts: FetchOptions = {}) {
    if (!selectedRepo.value) return
    if (loading.value && !opts.refresh) return

    const id = ++fetchPrsSeq
    loading.value = true
    errorKey.value = null
    try {
      const after = cursorStack.value[cursorStack.value.length - 1]
      const response = await apiFetch<PullRequestListResponse>('/api/pull-requests', {
        params: {
          repo: selectedRepo.value,
          state: stateFilter.value,
          first: PAGE_SIZE,
          after: after ?? undefined,
        },
      })
      if (id !== fetchPrsSeq) return
      prs.value = response.items
      totalCount.value = response.totalCount
      hasMore.value = response.pageInfo.hasNextPage
      nextCursor.value = response.pageInfo.endCursor
      loaded.value = true
    }
    catch (err) {
      if (id !== fetchPrsSeq) return
      errorKey.value = mapErrorKey(err)
      prs.value = []
    }
    finally {
      if (id === fetchPrsSeq) loading.value = false
    }
  }

  async function fetchHighlights() {
    if (!selectedRepo.value) return
    if (stateFilter.value !== 'open') {
      readyToMerge.reset()
      reviewsRequested.reset()
      return
    }
    await Promise.all([
      readyToMerge.fetchPage(selectedRepo.value),
      reviewsRequested.fetchPage(selectedRepo.value),
    ])
  }

  async function selectRepo(repo: string) {
    if (repo === selectedRepo.value && loaded.value) return
    selectedRepo.value = repo
    cursorStack.value = [null]
    readyToMerge.reset()
    reviewsRequested.reset()
    loaded.value = false
    await Promise.all([fetchPrs({ refresh: true }), fetchHighlights()])
  }

  async function setStateFilter(state: PrStateFilter) {
    if (stateFilter.value === state) return
    stateFilter.value = state
    cursorStack.value = [null]
    readyToMerge.reset()
    reviewsRequested.reset()
    await Promise.all([fetchPrs({ refresh: true }), fetchHighlights()])
  }

  async function loadNextPage() {
    if (!hasMore.value || paging.value || !nextCursor.value) return
    paging.value = 'next'
    try {
      cursorStack.value.push(nextCursor.value)
      await fetchPrs({ refresh: true })
    }
    finally {
      paging.value = null
    }
  }

  async function loadPreviousPage() {
    if (!hasPrevious.value || paging.value) return
    paging.value = 'prev'
    try {
      cursorStack.value.pop()
      await fetchPrs({ refresh: true })
    }
    finally {
      paging.value = null
    }
  }

  async function refresh() {
    cursorStack.value = [null]
    readyToMerge.reset()
    reviewsRequested.reset()
    loaded.value = false
    await Promise.all([fetchPrs({ refresh: true }), fetchHighlights()])
  }

  // Wrappers so callers don't need to thread `selectedRepo` through.
  async function loadHighlightNext(section: 'ready' | 'reviews') {
    if (!selectedRepo.value) return
    const target = section === 'ready' ? readyToMerge : reviewsRequested
    await target.loadNext(selectedRepo.value)
  }

  async function loadHighlightPrevious(section: 'ready' | 'reviews') {
    if (!selectedRepo.value) return
    const target = section === 'ready' ? readyToMerge : reviewsRequested
    await target.loadPrevious(selectedRepo.value)
  }

  return {
    selectedRepo,
    prs,
    readyToMerge,
    reviewsRequested,
    loaded,
    loading,
    errorKey,
    stateFilter,
    totalCount,
    hasMore,
    hasPrevious,
    paging,
    currentPage,
    totalPages,
    fetchPrs,
    fetchHighlights,
    selectRepo,
    setStateFilter,
    loadNextPage,
    loadPreviousPage,
    loadHighlightNext,
    loadHighlightPrevious,
    refresh,
  }
})
