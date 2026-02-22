import type { FocusItem } from '~~/server/api/focus/working-on.get'
import type { CreatedIssueItem } from '~~/server/api/focus/created.get'
import type { FocusCounts } from '~~/server/api/focus/counts.get'
import type { PaginatedResponse } from '~~/shared/types/pagination'
import type { InboxItem } from '~~/shared/types/inbox'

type SectionKey = 'workingOn' | 'inbox' | 'created' | 'watching' | 'recent'

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
  resetPagination: () => void
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

  function resetPagination() {
    paging.value = null
    cursorHistory.value = []
    _hasMore.value = false
    endCursor.value = null
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
    resetPagination,
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

  // --- Inbox: 3 paginated categories ---
  const inboxReviewRequests = usePaginatedSection<InboxItem>(
    apiFetch,
    '/api/focus/inbox',
    20,
    () => ({ category: 'reviewRequests' }),
  )
  const inboxAssigned = usePaginatedSection<InboxItem>(
    apiFetch,
    '/api/focus/inbox',
    20,
    () => ({ category: 'assigned' }),
  )
  const inboxMentions = usePaginatedSection<InboxItem>(
    apiFetch,
    '/api/focus/inbox',
    20,
    () => ({ category: 'mentions' }),
  )

  // Unified loading/fetchedAt for the inbox section header
  const inboxLoading = computed(() =>
    inboxReviewRequests.loading.value || inboxAssigned.loading.value || inboxMentions.loading.value,
  )
  const inboxFetchedAt = computed(() => {
    const times = [inboxReviewRequests.fetchedAt.value, inboxAssigned.fetchedAt.value, inboxMentions.fetchedAt.value]
    if (times.some(t => t === null)) return null
    return Math.min(...times.filter(Boolean) as number[])
  })

  // Expose as a unified object for sectionState() compatibility
  const inbox = computed(() => ({
    loading: inboxLoading.value,
    fetchedAt: inboxFetchedAt.value,
  }))

  async function fetchInbox() {
    await Promise.all([
      inboxReviewRequests.isStale() ? inboxReviewRequests.fetch() : Promise.resolve(true),
      inboxAssigned.isStale() ? inboxAssigned.fetch() : Promise.resolve(true),
      inboxMentions.isStale() ? inboxMentions.fetch() : Promise.resolve(true),
    ])
  }

  // --- Inbox filtering (server-side when needed) ---
  type InboxCategory = 'reviewRequests' | 'assigned' | 'mentions'

  const inboxSections: Record<InboxCategory, PaginatedSection<InboxItem>> = {
    reviewRequests: inboxReviewRequests,
    assigned: inboxAssigned,
    mentions: inboxMentions,
  }

  // Cache unfiltered data so we can restore without API call
  const inboxUnfilteredCache = new Map<InboxCategory, { data: InboxItem[], totalCount: number }>()

  function cacheUnfiltered(category: InboxCategory) {
    const section = inboxSections[category]
    if (!inboxUnfilteredCache.has(category) && section.fetchedAt.value) {
      inboxUnfilteredCache.set(category, {
        data: [...section.data.value],
        totalCount: section.totalCount.value,
      })
    }
  }

  async function filterInbox(category: InboxCategory, search: string, repos: string[]) {
    const section = inboxSections[category]
    const hasFilter = search.length > 0 || repos.length > 0

    // Cache unfiltered state on first filter
    cacheUnfiltered(category)

    if (!hasFilter) {
      // Restore from cache
      const cached = inboxUnfilteredCache.get(category)
      if (cached) {
        section.data.value = cached.data
        section.totalCount.value = cached.totalCount
        section.resetPagination()
      }
      return
    }

    // If all items fit on one page, filter client-side
    const cached = inboxUnfilteredCache.get(category)
    const allLoaded = cached && cached.totalCount <= 20

    if (allLoaded) {
      const searchLower = search.toLowerCase()
      section.data.value = cached.data.filter((i) => {
        if (search && !i.title.toLowerCase().includes(searchLower) && !`#${i.number}`.includes(search)) return false
        if (repos.length > 0 && !repos.includes(i.repo)) return false
        return true
      })
      section.totalCount.value = section.data.value.length
      section.resetPagination()
      return
    }

    // Server-side filter: multiple repos = multiple calls not practical, use first repo
    const params: Record<string, string | number> = { category, first: 20 }
    if (search) params.search = search
    if (repos.length === 1 && repos[0]) params.repo = repos[0]

    section.loading.value = true
    try {
      const res = await apiFetch<PaginatedResponse<InboxItem>>('/api/focus/inbox', { params })
      // For multi-repo filter, do client-side filtering on API results
      section.data.value = repos.length > 1
        ? res.items.filter(i => repos.includes(i.repo))
        : res.items
      section.totalCount.value = res.totalCount
      section.resetPagination()
    }
    catch {
      section.error.value = true
    }
    finally {
      section.loading.value = false
    }
  }

  async function markInboxSeen() {
    try {
      await apiFetch('/api/focus/inbox-seen', { method: 'PUT' })
    }
    catch {
      // Non-critical
    }
  }

  function updateCacheDismissed(repo: string, number: number, isDismissed: boolean) {
    for (const [, cached] of inboxUnfilteredCache) {
      const item = cached.data.find(i => i.repo === repo && i.number === number)
      if (item) item.isDismissed = isDismissed
    }
  }

  async function dismissInboxItem(repo: string, number: number) {
    const itemKey = `${repo}#${number}`
    // Optimistic UI: mark as dismissed locally
    for (const section of [inboxReviewRequests, inboxAssigned, inboxMentions]) {
      const item = section.data.value.find(i => i.repo === repo && i.number === number)
      if (item) item.isDismissed = true
    }
    updateCacheDismissed(repo, number, true)
    try {
      await apiFetch('/api/focus/inbox-dismiss', { method: 'PUT', body: { itemKey } })
    }
    catch {
      // Rollback on failure
      for (const section of [inboxReviewRequests, inboxAssigned, inboxMentions]) {
        const item = section.data.value.find(i => i.repo === repo && i.number === number)
        if (item) item.isDismissed = false
      }
      updateCacheDismissed(repo, number, false)
    }
  }

  async function restoreInboxItem(repo: string, number: number) {
    const itemKey = `${repo}#${number}`
    // Optimistic UI: mark as not dismissed
    for (const section of [inboxReviewRequests, inboxAssigned, inboxMentions]) {
      const item = section.data.value.find(i => i.repo === repo && i.number === number)
      if (item) item.isDismissed = false
    }
    updateCacheDismissed(repo, number, false)
    try {
      await apiFetch('/api/focus/inbox-restore', { method: 'PUT', body: { itemKey } })
    }
    catch {
      // Rollback on failure
      for (const section of [inboxReviewRequests, inboxAssigned, inboxMentions]) {
        const item = section.data.value.find(i => i.repo === repo && i.number === number)
        if (item) item.isDismissed = true
      }
      updateCacheDismissed(repo, number, true)
    }
  }

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
    if (key === 'inbox') {
      await fetchInbox()
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
    if (key === 'inbox') {
      await Promise.all([
        inboxReviewRequests.refresh(),
        inboxAssigned.refresh(),
        inboxMentions.refresh(),
      ])
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
    inbox,
    inboxReviewRequests,
    inboxAssigned,
    inboxMentions,
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
    markInboxSeen,
    dismissInboxItem,
    restoreInboxItem,
    filterInbox,
    // Actions
    toggle,
    setCreatedFilter,
    createdNextPage: () => activeCreated.value.nextPage(),
    createdPrevPage: () => activeCreated.value.prevPage(),
    refreshSection,
  }
})
