import type { WorkItemDetail } from '~~/shared/types/work-item'

const POLL_INTERVAL = 20_000

export function useWorkItemPolling(
  workItem: Ref<WorkItemDetail | null | undefined>,
  fetchUrl: Ref<string>,
) {
  const requestFetch = useRequestFetch()

  let timer: ReturnType<typeof setInterval> | null = null

  const checkUrl = computed(() => `${fetchUrl.value}/check`)

  async function tick() {
    try {
      // Lightweight check with ETag — 304 = free, no API cost
      const { changed } = await requestFetch<{ changed: boolean }>(checkUrl.value)
      if (!changed) return

      // Something changed — replace ref to trigger Vue reactivity
      const fresh = await requestFetch<WorkItemDetail>(fetchUrl.value)
      if (fresh && workItem.value) {
        workItem.value = { ...workItem.value, ...fresh }
      }
    }
    catch {
      // Network error — skip this round
    }
  }

  function start() {
    if (timer) return
    timer = setInterval(tick, POLL_INTERVAL)
  }

  function stop() {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  // Warm up ETag cache on mount, then start polling
  onMounted(async () => {
    try {
      await requestFetch(checkUrl.value)
    }
    catch {}
    start()
  })

  // Manual trigger (e.g. after merge) — immediate check + reload
  async function trigger() {
    if (import.meta.client) {
      if (!timer) start()
      await tick()
    }
  }

  onScopeDispose(stop)

  return {
    trigger,
  }
}
