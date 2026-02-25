import type { FocusItem } from '~~/server/api/focus/working-on.get'
import type { CreatedIssueItem } from '~~/server/api/focus/created.get'
import type { FocusCounts } from '~~/server/api/focus/counts.get'
import type { PaginatedResponse } from '~~/shared/types/pagination'
import type { UnifiedInboxItem } from '~~/shared/types/inbox'

type SectionKey = 'workingOn' | 'inbox' | 'created' | 'watching' | 'recent'

const STALE_MS = 2 * 60 * 1000 // 2 minutes
const POLL_INTERVAL = 30_000 // 30 seconds

function usePolling(callback: () => Promise<void>) {
  let timer: ReturnType<typeof setInterval> | null = null

  function start() {
    stop()
    timer = setInterval(callback, POLL_INTERVAL)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  return { start, stop }
}

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

  // --- Maintaining Inbox: scope-based PRs + Issues ---
  const inboxScope = ref<string>('') // org name or user login
  const inboxRepo = ref<string>('')
  const inboxSearch = ref<string>('')

  function inboxParams(category: 'pr' | 'issue') {
    const p: Record<string, string> = { category, scope: inboxScope.value }
    if (inboxRepo.value) p.repo = inboxRepo.value
    if (inboxSearch.value) p.search = inboxSearch.value
    return p
  }

  const inboxPRs = usePaginatedSection<UnifiedInboxItem>(
    apiFetch,
    '/api/focus/inbox-unified',
    20,
    () => inboxParams('pr'),
  )

  const inboxIssues = usePaginatedSection<UnifiedInboxItem>(
    apiFetch,
    '/api/focus/inbox-unified',
    20,
    () => inboxParams('issue'),
  )

  const inbox = computed(() => ({
    loading: inboxPRs.loading.value || inboxIssues.loading.value,
    fetchedAt: Math.min(inboxPRs.fetchedAt.value ?? 0, inboxIssues.fetchedAt.value ?? 0) || null,
  }))

  const inboxTotalCount = computed(() =>
    inboxPRs.totalCount.value + inboxIssues.totalCount.value,
  )

  // --- "New" notification tracking ---
  const inboxNewCount = ref(0)
  const _notifSince = ref<string | null>(null)
  const _notifLastModified = ref('')

  async function pollNotifications() {
    if (!_notifSince.value) return

    const params: Record<string, string> = { since: _notifSince.value }
    if (_notifLastModified.value) params.lastModified = _notifLastModified.value
    if (inboxRepo.value) params.repo = inboxRepo.value

    try {
      const res = await apiFetch<{ count: number, modified: boolean, lastModified?: string }>(
        '/api/focus/inbox-notifications',
        { params },
      )
      if (res.modified) {
        inboxNewCount.value = res.count
        if (res.lastModified) _notifLastModified.value = res.lastModified
      }
    }
    catch {
      // Non-critical
    }
  }

  const notifPolling = usePolling(pollNotifications)

  function markInboxSeen() {
    _notifSince.value = new Date().toISOString()
    _notifLastModified.value = ''
    inboxNewCount.value = 0
  }

  async function fetchInbox() {
    await Promise.all([
      inboxPRs.fetch(),
      inboxIssues.fetch(),
    ])
    markInboxSeen()
    notifPolling.start()
  }

  async function reloadInbox() {
    inboxPRs.resetPagination()
    inboxIssues.resetPagination()
    await fetchInbox()
  }

  async function setInboxScope(scope: string) {
    if (inboxScope.value === scope) return
    inboxScope.value = scope
    inboxRepo.value = ''
    await reloadInbox()
    // Persist selection
    apiFetch('/api/user/settings', {
      method: 'PUT',
      body: { inboxScope: scope },
    }).catch(() => {})
  }

  async function setInboxRepo(repo: string) {
    if (inboxRepo.value === repo) return
    inboxRepo.value = repo
    await reloadInbox()
  }

  async function setInboxSearch(search: string) {
    if (inboxSearch.value === search) return
    inboxSearch.value = search
    await reloadInbox()
  }

  async function dismissInboxItem(repo: string, number: number) {
    const itemKey = `${repo}#${number}`
    const item = inboxPRs.data.value.find(i => i.repo === repo && i.number === number)
      ?? inboxIssues.data.value.find(i => i.repo === repo && i.number === number)
    if (item) item.isDismissed = true
    try {
      await apiFetch('/api/focus/inbox-dismiss', { method: 'PUT', body: { itemKey } })
    }
    catch {
      if (item) item.isDismissed = false
    }
  }

  async function restoreInboxItem(repo: string, number: number) {
    const itemKey = `${repo}#${number}`
    const item = inboxPRs.data.value.find(i => i.repo === repo && i.number === number)
      ?? inboxIssues.data.value.find(i => i.repo === repo && i.number === number)
    if (item) item.isDismissed = false
    try {
      await apiFetch('/api/focus/inbox-restore', { method: 'PUT', body: { itemKey } })
    }
    catch {
      if (item) item.isDismissed = true
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
      if (key === 'inbox') ciPolling.stop()
      return
    }
    if (expanded.value === 'inbox') ciPolling.stop()
    expanded.value = key

    if (key === 'workingOn' && isStale(workingOn.value.fetchedAt)) {
      await fetchWorkingOn()
    }
    if (key === 'inbox' && (inboxPRs.isStale() || inboxIssues.isStale())) {
      await fetchInbox()
    }
    if (key === 'inbox') {
      ciPolling.start()
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

  // --- CI status polling for pending PRs ---
  async function pollCiStatus() {
    const keys = inboxPRs.data.value
      .filter(pr => pr.ciStatus === 'PENDING')
      .map(pr => `${pr.repo}#${pr.number}`)
    if (keys.length === 0) return

    try {
      const result = await apiFetch<Record<string, string | null>>('/api/focus/inbox-ci', {
        params: { prs: keys.join(',') },
      })

      for (const pr of inboxPRs.data.value) {
        const key = `${pr.repo}#${pr.number}`
        if (key in result && result[key] !== pr.ciStatus) {
          pr.ciStatus = result[key] as typeof pr.ciStatus
        }
      }
    }
    catch {
      // Non-critical — will retry on next interval
    }
  }

  const ciPolling = usePolling(pollCiStatus)

  async function refreshInboxNew() {
    expanded.value = 'inbox'
    await reloadInbox()
    ciPolling.start()
  }

  async function refreshSection(key: SectionKey) {
    if (key === 'workingOn') {
      workingOn.value.fetchedAt = null
      await fetchWorkingOn()
    }
    if (key === 'inbox') {
      await Promise.all([inboxPRs.refresh(), inboxIssues.refresh()])
      markInboxSeen()
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
    inboxScope,
    inboxRepo,
    inboxSearch,
    setInboxScope,
    setInboxRepo,
    setInboxSearch,
    inboxTotalCount,
    // Inbox PRs
    inboxPRs: computed(() => ({
      data: inboxPRs.data.value,
      loading: inboxPRs.loading.value,
      totalCount: inboxPRs.totalCount.value,
      page: inboxPRs.currentPage.value,
      totalPages: inboxPRs.totalPages.value,
      hasMore: inboxPRs.hasMore.value,
      hasPrevious: inboxPRs.hasPrevious.value,
      paging: inboxPRs.paging.value,
    })),
    inboxPRsNextPage: () => inboxPRs.nextPage(),
    inboxPRsPrevPage: () => inboxPRs.prevPage(),
    // Inbox Issues
    inboxIssues: computed(() => ({
      data: inboxIssues.data.value,
      loading: inboxIssues.loading.value,
      totalCount: inboxIssues.totalCount.value,
      page: inboxIssues.currentPage.value,
      totalPages: inboxIssues.totalPages.value,
      hasMore: inboxIssues.hasMore.value,
      hasPrevious: inboxIssues.hasPrevious.value,
      paging: inboxIssues.paging.value,
    })),
    inboxIssuesNextPage: () => inboxIssues.nextPage(),
    inboxIssuesPrevPage: () => inboxIssues.prevPage(),
    dismissInboxItem,
    restoreInboxItem,
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
    inboxNewCount,
    refreshInboxNew,
    stopCiPolling: ciPolling.stop,
    stopNotifPolling: notifPolling.stop,
  }
})
