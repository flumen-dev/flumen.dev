import type { FocusItem } from '~~/server/api/focus/working-on.get'
import type { CreatedIssueItem } from '~~/server/api/focus/created.get'
import type { FocusCounts } from '~~/server/api/focus/counts.get'
import type { PaginatedResponse } from '~~/shared/types/pagination'

type SectionKey = 'workingOn' | 'created' | 'watching' | 'recent'

const STALE_MS = 2 * 60 * 1000 // 2 minutes

// --- Reusable paginated section ---

interface PaginatedSection<T> {
  data: Ref<T[]>
  loading: Ref<boolean>
  error: Ref<boolean>
  fetchedAt: Ref<number | null>
  totalCount: Ref<number>
  hasMore: ComputedRef<boolean>
  hasPrevious: ComputedRef<boolean>
  currentPage: ComputedRef<number>
  totalPages: ComputedRef<number>
  paging: Ref<'next' | 'prev' | null>
  fetch: (after?: string | null) => Promise<boolean>
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
  refresh: () => Promise<void>
  isStale: () => boolean
}

function usePaginatedSection<T>(
  apiFetch: ReturnType<typeof useRequestFetch>,
  endpoint: string,
  pageSize: number,
  buildParams: () => Record<string, string | number>,
): PaginatedSection<T> {
  const data = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const error = ref(false)
  const fetchedAt = ref<number | null>(null)
  const totalCount = ref(0)
  const endCursor = ref<string | null>(null)
  const _hasMore = ref(false)
  const cursorHistory = ref<string[]>([])
  const paging = ref<'next' | 'prev' | null>(null)

  const hasMore = computed(() => _hasMore.value)
  const hasPrevious = computed(() => cursorHistory.value.length > 0)
  const currentPage = computed(() => cursorHistory.value.length + 1)
  const totalPages = computed(() => Math.ceil(totalCount.value / pageSize))

  function isStale(): boolean {
    if (!fetchedAt.value) return true
    return Date.now() - fetchedAt.value > STALE_MS
  }

  async function fetchData(after?: string | null): Promise<boolean> {
    loading.value = true
    error.value = false
    try {
      const params: Record<string, string | number> = { ...buildParams(), first: pageSize }
      if (after) params.after = after

      const res = await apiFetch<PaginatedResponse<T>>(endpoint, { params })
      data.value = res.items
      fetchedAt.value = Date.now()
      totalCount.value = res.totalCount
      _hasMore.value = res.pageInfo.hasNextPage
      endCursor.value = res.pageInfo.endCursor
      return true
    }
    catch {
      error.value = true
      return false
    }
    finally {
      loading.value = false
    }
  }

  async function nextPage() {
    if (!_hasMore.value || !endCursor.value) return
    const cursor = endCursor.value
    paging.value = 'next'
    try {
      if (await fetchData(cursor)) {
        cursorHistory.value.push(cursor)
      }
    }
    finally {
      paging.value = null
    }
  }

  async function prevPage() {
    if (!cursorHistory.value.length) return
    const prevCursor = cursorHistory.value.slice(0, -1).at(-1) ?? null
    paging.value = 'prev'
    try {
      if (await fetchData(prevCursor)) {
        cursorHistory.value.pop()
      }
    }
    finally {
      paging.value = null
    }
  }

  async function refresh() {
    const prevHistory = cursorHistory.value
    cursorHistory.value = []
    if (!await fetchData()) {
      cursorHistory.value = prevHistory
    }
  }

  return {
    data,
    loading,
    error,
    fetchedAt,
    totalCount,
    hasMore,
    hasPrevious,
    currentPage,
    totalPages,
    paging,
    fetch: fetchData,
    nextPage,
    prevPage,
    refresh,
    isStale,
  }
}

// --- Store ---

export const useFocusStore = defineStore('focus', () => {
  const apiFetch = useRequestFetch()

  const expanded = ref<SectionKey | null>(null)

  // --- Counts (lightweight, loaded on mount) ---
  const counts = ref<FocusCounts | null>(null)
  const countsFetchedAt = ref<number | null>(null)
  const countsLoading = ref(false)

  async function fetchCounts() {
    if (!isStale(countsFetchedAt.value)) return
    countsLoading.value = true
    try {
      const res = await apiFetch<FocusCounts>('/api/focus/counts')
      counts.value = res
      countsFetchedAt.value = Date.now()
    }
    catch {
      // Non-critical — sections still work without counts
    }
    finally {
      countsLoading.value = false
    }
  }

  // --- Simple sections ---
  const workingOn = ref<{ data: FocusItem[], loading: boolean, error: boolean, fetchedAt: number | null }>({
    data: [],
    loading: false,
    error: false,
    fetchedAt: null,
  })

  const watching = ref<{ data: never[], loading: boolean, fetchedAt: number | null }>({
    data: [],
    loading: false,
    fetchedAt: null,
  })

  const recent = ref<{ data: never[], loading: boolean, fetchedAt: number | null }>({
    data: [],
    loading: false,
    fetchedAt: null,
  })

  // --- Created: paginated with state filter ---
  const createdStateFilter = ref<'open' | 'closed'>('open')

  const createdOpen = usePaginatedSection<CreatedIssueItem>(
    apiFetch,
    '/api/focus/created',
    20,
    () => ({ state: 'open' }),
  )

  const createdClosed = usePaginatedSection<CreatedIssueItem>(
    apiFetch,
    '/api/focus/created',
    20,
    () => ({ state: 'closed' }),
  )

  const activeCreated = computed(() =>
    createdStateFilter.value === 'open' ? createdOpen : createdClosed,
  )

  // Expose the active section's reactive state for the template
  const created = computed(() => ({
    data: activeCreated.value.data.value,
    loading: activeCreated.value.loading.value,
    error: activeCreated.value.error.value,
    fetchedAt: activeCreated.value.fetchedAt.value,
  }))
  const createdTotalCount = computed(() => activeCreated.value.totalCount.value)
  const createdHasMore = computed(() => activeCreated.value.hasMore.value)
  const createdHasPrevious = computed(() => activeCreated.value.hasPrevious.value)
  const createdPage = computed(() => activeCreated.value.currentPage.value)
  const createdTotalPages = computed(() => activeCreated.value.totalPages.value)
  const createdPaging = computed(() => activeCreated.value.paging.value)

  // --- Helpers ---

  function isStale(fetchedAt: number | null): boolean {
    if (!fetchedAt) return true
    return Date.now() - fetchedAt > STALE_MS
  }

  async function fetchWorkingOn() {
    workingOn.value.loading = true
    workingOn.value.error = false
    try {
      const res = await apiFetch<{ items: FocusItem[] }>('/api/focus/working-on')
      workingOn.value.data = res.items
      workingOn.value.fetchedAt = Date.now()
    }
    catch {
      workingOn.value.error = true
    }
    finally {
      workingOn.value.loading = false
    }
  }

  // --- Toggle + lazy fetch ---
  async function toggle(key: SectionKey) {
    if (expanded.value === key) {
      expanded.value = null
      return
    }
    expanded.value = key

    if (key === 'workingOn' && isStale(workingOn.value.fetchedAt)) {
      await fetchWorkingOn()
    }
    if (key === 'created' && activeCreated.value.isStale()) {
      await activeCreated.value.fetch()
    }
  }

  async function setCreatedFilter(state: 'open' | 'closed') {
    if (createdStateFilter.value === state) return
    createdStateFilter.value = state
    if (activeCreated.value.isStale()) {
      await activeCreated.value.fetch()
    }
  }

  async function refreshSection(key: SectionKey) {
    if (key === 'workingOn') {
      workingOn.value.fetchedAt = null
      await fetchWorkingOn()
    }
    if (key === 'created') {
      await activeCreated.value.refresh()
    }
  }

  return {
    expanded,
    counts,
    countsLoading,
    fetchCounts,
    workingOn,
    watching,
    recent,
    // Created
    created,
    createdStateFilter,
    createdTotalCount,
    createdPage,
    createdTotalPages,
    createdHasMore,
    createdHasPrevious,
    createdPaging,
    // Actions
    toggle,
    setCreatedFilter,
    createdNextPage: () => activeCreated.value.nextPage(),
    createdPrevPage: () => activeCreated.value.prevPage(),
    refreshSection,
  }
})
