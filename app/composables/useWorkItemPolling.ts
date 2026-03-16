import type { WorkItemDetail } from '~~/shared/types/work-item'

const POLL_INTERVAL = 15_000

export function useWorkItemPolling(
  workItem: Ref<WorkItemDetail | null | undefined>,
  fetchUrl: Ref<string>,
) {
  const requestFetch = useRequestFetch()

  let timer: ReturnType<typeof setInterval> | null = null

  const checkUrl = computed(() => {
    const wi = workItem.value
    if (!wi) return `${fetchUrl.value}/check`
    const prNums: number[] = []
    if (wi.primaryType === 'pull') {
      // Primary is PR — issue endpoint already covers it
    }
    else {
      // Issue-primary: also check linked PRs
      for (const c of wi.contributions) prNums.push(c.number)
      for (const p of wi.linkedPulls) {
        if (!prNums.includes(p.number)) prNums.push(p.number)
      }
    }
    const params = prNums.length ? `?prs=${prNums.join(',')}` : ''
    return `${fetchUrl.value}/check${params}`
  })

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
    await requestFetch(checkUrl.value).catch(() => null)
    start()
  })

  const invalidateUrl = computed(() => `${fetchUrl.value}/invalidate`)

  // Force reload (e.g. after merge/review/CI/PR creation)
  // Always invalidates server cache first since we know something changed
  async function trigger() {
    if (!import.meta.client) return
    if (!timer) start()
    await new Promise(r => setTimeout(r, 3_000))
    try {
      await requestFetch(invalidateUrl.value, { method: 'POST' }).catch(() => null)
      const fresh = await requestFetch<WorkItemDetail>(fetchUrl.value)
      if (fresh && workItem.value) {
        workItem.value = { ...workItem.value, ...fresh }
      }
    }
    catch {
      // Network error — next tick will retry
    }
  }

  onScopeDispose(stop)

  return {
    trigger,
  }
}
