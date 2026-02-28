import type { FocusItem } from '~~/server/api/focus/working-on.get'
import type { CreatedIssueItem } from '~~/server/api/focus/created.get'
import type { FocusCounts } from '~~/server/api/focus/counts.get'
import type { UnifiedInboxItem, InboxPreview } from '~~/shared/types/inbox'
import { buildWorkItemPath } from '~/utils/workItemPath'

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

// --- Store ---

export const useFocusStore = defineStore('focus', () => {
  const apiFetch = useRequestFetch()

  const expanded = ref<SectionKey | null>(null)

  // --- Keyboard navigation ---
  const highlightedKey = ref<string | null>(null)

  // --- Dismiss state ---
  const dismissedKeys = ref<Set<string>>(new Set())

  // --- Selection state (batch operations) ---
  const selectedKeys = ref<Set<string>>(new Set())

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
  const inboxPRStateFilter = ref<'open' | 'closed'>('open')
  const inboxIssueStateFilter = ref<'open' | 'closed'>('open')

  function inboxParams(category: 'pr' | 'issue', state: 'open' | 'closed') {
    const p: Record<string, string> = { category, state, scope: inboxScope.value }
    if (inboxRepo.value) p.repo = inboxRepo.value
    if (inboxSearch.value) p.search = inboxSearch.value
    return p
  }

  const inboxPRsOpen = usePaginatedSection<UnifiedInboxItem>(
    apiFetch, '/api/focus/inbox-unified', 20, () => inboxParams('pr', 'open'),
  )
  const inboxPRsClosed = usePaginatedSection<UnifiedInboxItem>(
    apiFetch, '/api/focus/inbox-unified', 20, () => inboxParams('pr', 'closed'),
  )
  const inboxIssuesOpen = usePaginatedSection<UnifiedInboxItem>(
    apiFetch, '/api/focus/inbox-unified', 20, () => inboxParams('issue', 'open'),
  )
  const inboxIssuesClosed = usePaginatedSection<UnifiedInboxItem>(
    apiFetch, '/api/focus/inbox-unified', 20, () => inboxParams('issue', 'closed'),
  )

  const activeInboxPRs = computed(() =>
    inboxPRStateFilter.value === 'open' ? inboxPRsOpen : inboxPRsClosed,
  )
  const activeInboxIssues = computed(() =>
    inboxIssueStateFilter.value === 'open' ? inboxIssuesOpen : inboxIssuesClosed,
  )

  const inbox = computed(() => ({
    loading: activeInboxPRs.value.loading.value || activeInboxIssues.value.loading.value,
    fetchedAt: Math.min(activeInboxPRs.value.fetchedAt.value ?? 0, activeInboxIssues.value.fetchedAt.value ?? 0) || null,
  }))

  const inboxTotalCount = computed(() =>
    activeInboxPRs.value.totalCount.value + activeInboxIssues.value.totalCount.value,
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
      activeInboxPRs.value.fetch(),
      activeInboxIssues.value.fetch(),
    ])
    markInboxSeen()
    notifPolling.start()
  }

  function invalidateAllInboxCaches() {
    for (const s of [inboxPRsOpen, inboxPRsClosed, inboxIssuesOpen, inboxIssuesClosed]) {
      s.resetPagination()
      s.fetchedAt.value = null
    }
  }

  async function reloadInbox() {
    invalidateAllInboxCaches()
    await fetchInbox()
  }

  async function setInboxPRState(state: 'open' | 'closed') {
    if (inboxPRStateFilter.value === state) return
    inboxPRStateFilter.value = state
    if (activeInboxPRs.value.isStale()) {
      await activeInboxPRs.value.fetch()
    }
  }

  async function setInboxIssueState(state: 'open' | 'closed') {
    if (inboxIssueStateFilter.value === state) return
    inboxIssueStateFilter.value = state
    if (activeInboxIssues.value.isStale()) {
      await activeInboxIssues.value.fetch()
    }
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

  // --- Preview cache (click-to-load, cached per key) ---
  const previewCache = ref<Record<string, InboxPreview>>({})
  const previewLoading = ref<Record<string, boolean>>({})

  async function fetchPreview(item: UnifiedInboxItem) {
    const key = `${item.repo}#${item.number}`
    if (previewCache.value[key]) return previewCache.value[key]
    if (previewLoading.value[key]) return null

    previewLoading.value[key] = true
    try {
      const res = await apiFetch<InboxPreview>('/api/focus/inbox-preview', {
        params: { repo: item.repo, number: item.number, type: item.type },
      })
      previewCache.value[key] = res
      return res
    }
    catch {
      return null
    }
    finally {
      previewLoading.value[key] = false
    }
  }

  function getPreview(item: UnifiedInboxItem): InboxPreview | null {
    return previewCache.value[`${item.repo}#${item.number}`] ?? null
  }

  function isPreviewLoading(item: UnifiedInboxItem): boolean {
    return !!previewLoading.value[`${item.repo}#${item.number}`]
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
    if (key === 'inbox' && (activeInboxPRs.value.isStale() || activeInboxIssues.value.isStale())) {
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
    const prData = activeInboxPRs.value.data.value
    const keys = prData
      .filter(pr => pr.ciStatus === 'PENDING')
      .map(pr => `${pr.repo}#${pr.number}`)
    if (keys.length === 0) return

    try {
      const result = await apiFetch<Record<string, string | null>>('/api/focus/inbox-ci', {
        params: { prs: keys.join(',') },
      })

      for (const pr of prData) {
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
      await Promise.all([activeInboxPRs.value.refresh(), activeInboxIssues.value.refresh()])
      markInboxSeen()
    }
    if (key === 'created') {
      await activeCreated.value.refresh()
    }
  }

  // --- Visible items (filtered by dismissed) ---
  const visiblePRs = computed(() =>
    activeInboxPRs.value.data.value.filter(item => !dismissedKeys.value.has(`${item.repo}#${item.number}`)),
  )
  const visibleIssues = computed(() =>
    activeInboxIssues.value.data.value.filter(item => !dismissedKeys.value.has(`${item.repo}#${item.number}`)),
  )

  const dismissedPRs = computed(() =>
    activeInboxPRs.value.data.value.filter(item => dismissedKeys.value.has(`${item.repo}#${item.number}`)),
  )
  const dismissedIssues = computed(() =>
    activeInboxIssues.value.data.value.filter(item => dismissedKeys.value.has(`${item.repo}#${item.number}`)),
  )

  // --- Flat items for keyboard navigation ---
  const flatItems = computed<UnifiedInboxItem[]>(() => [
    ...visiblePRs.value,
    ...visibleIssues.value,
  ])

  const highlightedItem = computed(() => {
    if (!highlightedKey.value) return null
    return flatItems.value.find(item => `${item.repo}#${item.number}` === highlightedKey.value) ?? null
  })

  function highlightNext() {
    const items = flatItems.value
    if (items.length === 0) return
    if (!highlightedKey.value) {
      highlightedKey.value = `${items[0]!.repo}#${items[0]!.number}`
      return
    }
    const idx = items.findIndex(item => `${item.repo}#${item.number}` === highlightedKey.value)
    const next = idx < items.length - 1 ? idx + 1 : 0
    highlightedKey.value = `${items[next]!.repo}#${items[next]!.number}`
  }

  function highlightPrev() {
    const items = flatItems.value
    if (items.length === 0) return
    if (!highlightedKey.value) {
      highlightedKey.value = `${items[items.length - 1]!.repo}#${items[items.length - 1]!.number}`
      return
    }
    const idx = items.findIndex(item => `${item.repo}#${item.number}` === highlightedKey.value)
    const prev = idx > 0 ? idx - 1 : items.length - 1
    highlightedKey.value = `${items[prev]!.repo}#${items[prev]!.number}`
  }

  function openHighlighted() {
    const item = highlightedItem.value
    if (!item) return
    const workItemPath = buildWorkItemPath(item.repo, item.number, item.type)
    if (workItemPath) {
      const lp = useLocalePath()
      navigateTo(lp(workItemPath))
      return
    }

    if (item.type === 'pr') {
      window.open(item.url, '_blank')
    }
    else {
      const lp = useLocalePath()
      navigateTo(lp({ path: `/issues/${item.number}`, query: { repo: item.repo } }))
    }
  }

  function dismissItem(key: string) {
    dismissedKeys.value = new Set([...dismissedKeys.value, key])
    persistDismissed()
  }

  function restoreItem(key: string) {
    const next = new Set(dismissedKeys.value)
    next.delete(key)
    dismissedKeys.value = next
    persistDismissed()
  }

  function toggleDismiss() {
    const key = highlightedKey.value
    if (!key) return
    const items = flatItems.value
    const idx = items.findIndex(item => `${item.repo}#${item.number}` === key)

    if (dismissedKeys.value.has(key)) {
      restoreItem(key)
    }
    else {
      dismissItem(key)
      // Auto-advance to next item after dismiss
      const remaining = items.filter(item => `${item.repo}#${item.number}` !== key)
      if (remaining.length === 0 || idx === -1) {
        highlightedKey.value = remaining.length > 0
          ? `${remaining[0]!.repo}#${remaining[0]!.number}`
          : null
      }
      else if (idx < remaining.length) {
        const next = remaining[idx]!
        highlightedKey.value = `${next.repo}#${next.number}`
      }
      else {
        const last = remaining[remaining.length - 1]!
        highlightedKey.value = `${last.repo}#${last.number}`
      }
    }

    // Debounced persist
    persistDismissed()
  }

  let _dismissTimer: ReturnType<typeof setTimeout> | null = null
  function persistDismissed() {
    if (_dismissTimer) clearTimeout(_dismissTimer)
    _dismissTimer = setTimeout(() => {
      apiFetch('/api/user/settings', {
        method: 'PUT',
        body: { dismissedInbox: [...dismissedKeys.value] },
      }).catch(() => {})
    }, 1000)
  }

  function loadDismissedFromSettings(keys: string[]) {
    dismissedKeys.value = new Set(keys)
  }

  // --- Batch selection ---
  function toggleSelect(key: string) {
    const next = new Set(selectedKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selectedKeys.value = next
  }

  function clearSelection() {
    selectedKeys.value = new Set()
  }

  function dismissSelected() {
    if (selectedKeys.value.size === 0) return
    dismissedKeys.value = new Set([...dismissedKeys.value, ...selectedKeys.value])
    selectedKeys.value = new Set()
    persistDismissed()
  }

  function restoreSelected() {
    if (selectedKeys.value.size === 0) return
    const next = new Set(dismissedKeys.value)
    for (const key of selectedKeys.value) next.delete(key)
    dismissedKeys.value = next
    selectedKeys.value = new Set()
    persistDismissed()
  }

  // Reset highlight + selection on filter/scope/page change
  watch(
    [inboxScope, inboxRepo, inboxSearch, inboxPRStateFilter, inboxIssueStateFilter],
    () => {
      highlightedKey.value = null
      selectedKeys.value = new Set()
    },
  )

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
    inboxPRStateFilter,
    inboxIssueStateFilter,
    setInboxPRState,
    setInboxIssueState,
    // Inbox PRs (flattened from active section)
    inboxPRs: computed(() => {
      const s = activeInboxPRs.value
      return {
        data: s.data.value,
        loading: s.loading.value,
        totalCount: s.totalCount.value,
        page: s.currentPage.value,
        totalPages: s.totalPages.value,
        hasMore: s.hasMore.value,
        hasPrevious: s.hasPrevious.value,
        paging: s.paging.value,
      }
    }),
    inboxPRsNextPage: () => activeInboxPRs.value.nextPage(),
    inboxPRsPrevPage: () => activeInboxPRs.value.prevPage(),
    // Inbox Issues (flattened from active section)
    inboxIssues: computed(() => {
      const s = activeInboxIssues.value
      return {
        data: s.data.value,
        loading: s.loading.value,
        totalCount: s.totalCount.value,
        page: s.currentPage.value,
        totalPages: s.totalPages.value,
        hasMore: s.hasMore.value,
        hasPrevious: s.hasPrevious.value,
        paging: s.paging.value,
      }
    }),
    inboxIssuesNextPage: () => activeInboxIssues.value.nextPage(),
    inboxIssuesPrevPage: () => activeInboxIssues.value.prevPage(),
    fetchPreview,
    getPreview,
    isPreviewLoading,
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
    // Keyboard navigation + dismiss
    highlightedKey,
    highlightedItem,
    flatItems,
    visiblePRs,
    visibleIssues,
    dismissedKeys,
    highlightNext,
    highlightPrev,
    openHighlighted,
    toggleDismiss,
    dismissItem,
    restoreItem,
    loadDismissedFromSettings,
    dismissedPRs,
    dismissedIssues,
    // Batch selection
    selectedKeys,
    toggleSelect,
    clearSelection,
    dismissSelected,
    restoreSelected,
  }
})
