import type { CheckRunsResult } from '~~/shared/types/check-run'

export function useCheckRuns(
  owner: Ref<string>,
  repo: Ref<string>,
  prNumbers: Ref<number[]>,
) {
  const requestFetch = useRequestFetch()
  const results = ref<Record<number, CheckRunsResult>>({})
  const loading = ref(false)
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

  // Poll while individual checks are pending OR the rollup says PENDING
  // (GitHub knows about queued checks before they appear in the contexts list)
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

    loading.value = true
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

      // Only update if we got at least one result, otherwise keep stale data
      if (anySuccess || !fetched.value) {
        results.value = next
      }
    }
    finally {
      loading.value = false
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

  // Stable key — doesn't change with prNumbers
  const stableKey = computed(() => `check-runs-${owner.value}-${repo.value}`)

  useAsyncData(
    stableKey,
    () => fetchAll(),
  )

  // Re-fetch when prNumbers actually change (by value, not reference)
  const prNumbersKey = computed(() => prNumbers.value.join(','))
  watch(prNumbersKey, () => {
    fetchAll()
  })

  watch(hasPending, (pending) => {
    if (import.meta.client && pending) {
      startPolling()
    }
    else {
      stopPolling()
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    stopPolling()
  })

  return {
    result: mergedResult,
    loading: computed(() => loading.value && !fetched.value),
    hasPending,
    statusChanged,
  }
}
