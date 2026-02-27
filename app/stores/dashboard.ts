import type { WaitingOnMeItem, WaitingOnMeResponse } from '~~/shared/types/waiting-on-me'

export const useDashboardStore = defineStore('dashboard', () => {
  const apiFetch = useRequestFetch()

  // --- Waiting On Me ---
  const waitingOnMe = ref<{
    data: WaitingOnMeItem[]
    summary: WaitingOnMeResponse['summary'] | null
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

  async function fetchWaitingOnMe() {
    waitingOnMe.value.loading = true
    waitingOnMe.value.error = false
    try {
      const res = await apiFetch<WaitingOnMeResponse>('/api/focus/waiting-on-me')
      waitingOnMe.value.data = res.items
      waitingOnMe.value.summary = res.summary
      waitingOnMe.value.fetchedAt = Date.now()
    }
    catch {
      waitingOnMe.value.error = true
    }
    finally {
      waitingOnMe.value.loading = false
    }
  }

  return {
    waitingOnMe,
    fetchWaitingOnMe,
  }
})
