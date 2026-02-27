import type { WaitingOnMeItem, WaitingOnMeCursors, WaitingOnMeResponse } from '~~/shared/types/waiting-on-me'
import type { PRHealthItem, PRHealthResponse } from '~~/shared/types/pr-health'

export const useDashboardStore = defineStore('dashboard', () => {
  const apiFetch = useRequestFetch()

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
      const res = await apiFetch<WaitingOnMeResponse>('/api/focus/waiting-on-me')
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
      const res = await apiFetch<WaitingOnMeResponse>(`/api/focus/waiting-on-me?${params}`)
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
      const res = await apiFetch<PRHealthResponse>('/api/focus/pr-health')
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

  return {
    waitingOnMe,
    fetchWaitingOnMe,
    loadMoreWaitingOnMe,
    prHealth,
    fetchPRHealth,
  }
})
