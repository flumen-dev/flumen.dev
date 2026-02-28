export type DashboardPanel = 'waitingOnMe' | 'prHealth' | 'pulse'

export const useDashboardStore = defineStore('dashboard', () => {
  const apiFetch = useRequestFetch()

  // --- Collapsed panels ---
  const collapsed = ref<Set<DashboardPanel>>(
    new Set(import.meta.client ? JSON.parse(localStorage.getItem('dashboard-collapsed') ?? '[]') : []),
  )

  function togglePanel(key: DashboardPanel) {
    const next = new Set(collapsed.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    collapsed.value = next
    if (import.meta.client)
      localStorage.setItem('dashboard-collapsed', JSON.stringify([...next]))
  }

  function isCollapsed(key: DashboardPanel) {
    return collapsed.value.has(key)
  }

  // --- Waiting On Me ---
  const waitingOnMe = ref<{
    data: WaitingOnMeItem[]
    summary: WaitingOnMeResponse['summary'] | null
    loading: boolean
    loadingMore: boolean
    error: boolean
    fetchedAt: number | null
    hasMore: boolean
    cursors: WaitingOnMeCursors | null
  }>({
    data: [],
    summary: null,
    loading: false,
    loadingMore: false,
    error: false,
    fetchedAt: null,
    hasMore: false,
    cursors: null,
  })

  async function fetchWaitingOnMe() {
    waitingOnMe.value.loading = true
    waitingOnMe.value.error = false
    try {
      const res = await apiFetch<WaitingOnMeResponse>('/api/dashboard/waiting-on-me')
      waitingOnMe.value.data = res.items
      waitingOnMe.value.summary = res.summary
      waitingOnMe.value.hasMore = res.hasMore
      waitingOnMe.value.cursors = res.cursors
      waitingOnMe.value.fetchedAt = Date.now()
    }
    catch {
      waitingOnMe.value.error = true
    }
    finally {
      waitingOnMe.value.loading = false
    }
  }

  async function loadMoreWaitingOnMe() {
    if (!waitingOnMe.value.hasMore || !waitingOnMe.value.cursors) return
    waitingOnMe.value.loadingMore = true
    try {
      const params = new URLSearchParams()
      if (waitingOnMe.value.cursors.review) params.set('cursorReview', waitingOnMe.value.cursors.review)
      if (waitingOnMe.value.cursors.assigned) params.set('cursorAssigned', waitingOnMe.value.cursors.assigned)
      if (waitingOnMe.value.cursors.changes) params.set('cursorChanges', waitingOnMe.value.cursors.changes)

      // Server merges with cached data and returns the full set
      const res = await apiFetch<WaitingOnMeResponse>(`/api/dashboard/waiting-on-me?${params}`)
      waitingOnMe.value.data = res.items
      waitingOnMe.value.summary = res.summary
      waitingOnMe.value.hasMore = res.hasMore
      waitingOnMe.value.cursors = res.cursors
    }
    catch {
      waitingOnMe.value.error = true
    }
    finally {
      waitingOnMe.value.loadingMore = false
    }
  }

  // --- PR Health ---
  const prHealth = ref<{
    data: PRHealthItem[]
    summary: PRHealthResponse['summary'] | null
    loading: boolean
    error: boolean
    fetchedAt: number | null
  }>({
    data: [],
    summary: null,
    loading: false,
    error: false,
    fetchedAt: null,
  })

  async function fetchPRHealth() {
    prHealth.value.loading = true
    prHealth.value.error = false
    try {
      const res = await apiFetch<PRHealthResponse>('/api/dashboard/pr-health')
      prHealth.value.data = res.items
      prHealth.value.summary = res.summary
      prHealth.value.fetchedAt = Date.now()
    }
    catch {
      prHealth.value.error = true
    }
    finally {
      prHealth.value.loading = false
    }
  }

  // --- Weekly Pulse ---
  const pulse = ref<{
    data: PulseResponse | null
    loading: boolean
    error: boolean
    fetchedAt: number | null
  }>({
    data: null,
    loading: false,
    error: false,
    fetchedAt: null,
  })

  async function fetchPulse() {
    pulse.value.loading = true
    pulse.value.error = false
    try {
      pulse.value.data = await apiFetch<PulseResponse>('/api/dashboard/pulse')
      pulse.value.fetchedAt = Date.now()
    }
    catch {
      pulse.value.error = true
    }
    finally {
      pulse.value.loading = false
    }
  }

  return {
    collapsed,
    togglePanel,
    isCollapsed,
    waitingOnMe,
    fetchWaitingOnMe,
    loadMoreWaitingOnMe,
    prHealth,
    fetchPRHealth,
    pulse,
    fetchPulse,
  }
})
