import type { CheckRunsResult } from '~~/shared/types/check-run'

export function useCheckRuns(
  owner: Ref<string>,
  repo: Ref<string>,
  prNumbers: Ref<number[]>,
) {
  const requestFetch = useRequestFetch()

  // Use useState so SSR data transfers to client (prevents hydration mismatch)
  const stateKey = `check-runs-${owner.value}-${repo.value}`
  const results = useState<Record<number, CheckRunsResult>>(stateKey, () => ({}))
  const fetched = ref(false)

  const mergedResult = computed<CheckRunsResult | null>(() => {
    const entries = Object.values(results.value)
    if (!entries.length) return null

    let total = 0
    let passed = 0
    let failed = 0
    let pending = 0
    const allChecks: CheckRunsResult['checks'] = []
    const allFailingNames: string[] = []
    let worstStatus: CheckRunsResult['rollupStatus'] = null

    for (const entry of entries) {
      total += entry.total
      passed += entry.passed
      failed += entry.failed
      pending += entry.pending
      allChecks.push(...entry.checks)
      allFailingNames.push(...entry.failingNames)

      if (entry.rollupStatus === 'FAILURE') worstStatus = 'FAILURE'
      else if (entry.rollupStatus === 'PENDING' && worstStatus !== 'FAILURE') worstStatus = 'PENDING'
      else if (entry.rollupStatus === 'SUCCESS' && !worstStatus) worstStatus = 'SUCCESS'
    }

    return {
      rollupStatus: worstStatus,
      total,
      passed,
      failed,
      pending,
      checks: allChecks,
      failingNames: allFailingNames,
    }
  })

  const hasPending = computed(() =>
    (mergedResult.value?.pending ?? 0) > 0
    || mergedResult.value?.rollupStatus === 'PENDING',
  )

  // Track status transitions so consumers can react (e.g. reload timeline)
  const statusChanged = ref(0)

  watch(() => mergedResult.value?.rollupStatus, (next, prev) => {
    if (prev != null && next != null && prev !== next) {
      statusChanged.value++
    }
  })

  async function fetchAll() {
    const numbers = prNumbers.value
    if (!numbers.length) {
      results.value = {}
      fetched.value = true
      return
    }

    try {
      const responses = await Promise.allSettled(
        numbers.map(n =>
          requestFetch<CheckRunsResult>(
            `/api/repository/${owner.value}/${repo.value}/pulls/${n}/checks`,
          ),
        ),
      )

      const next: Record<number, CheckRunsResult> = {}
      let anySuccess = false
      responses.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value) {
          next[numbers[i]!] = res.value
          anySuccess = true
        }
      })

      if (anySuccess || !fetched.value) {
        results.value = next
      }
    }
    finally {
      fetched.value = true
    }
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(async () => {
      if (!hasPending.value) {
        stopPolling()
        return
      }
      await fetchAll()
    }, 15_000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  useAsyncData(
    `async-${stateKey}`,
    () => fetchAll(),
  )

  // Re-fetch when prNumbers actually change (by value, not reference)
  const prNumbersKey = computed(() => prNumbers.value.join(','))
  watch(prNumbersKey, () => {
    fetchAll()
  })

  // Always poll while there are PR numbers to watch
  watch([hasPending, prNumbersKey], () => {
    if (!import.meta.client || !prNumbers.value.length) {
      stopPolling()
      return
    }
    if (hasPending.value) {
      startPolling()
    }
    else {
      // No pending checks, but still poll slowly to detect new runs (e.g. after push)
      stopPolling()
      pollTimer = setInterval(async () => {
        await fetchAll()
        if (hasPending.value) startPolling()
      }, 30_000)
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    stopPolling()
  })

  return {
    result: mergedResult,
    hasPending,
    statusChanged,
  }
}
