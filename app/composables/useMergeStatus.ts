import type { MergeStatusResult, MergeStrategy } from '~~/shared/types/merge'

export function useMergeStatus(
  owner: Ref<string>,
  repo: Ref<string>,
  prNumber: Ref<number | null>,
) {
  const status = ref<MergeStatusResult | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    if (!prNumber.value) return
    loading.value = true
    error.value = null
    try {
      status.value = await $fetch<MergeStatusResult>(
        `/api/repository/${owner.value}/${repo.value}/pulls/${prNumber.value}/merge-status`,
      )
    }
    catch (e: unknown) {
      const fetchErr = e as { data?: { message?: string }, message?: string }
      error.value = fetchErr.data?.message ?? fetchErr.message ?? 'Failed to load merge status'
    }
    finally {
      loading.value = false
    }
  }

  async function merge(strategy: MergeStrategy, commitTitle?: string, commitMessage?: string, sha?: string) {
    if (!prNumber.value) return null
    return await $fetch(
      `/api/repository/${owner.value}/${repo.value}/pulls/${prNumber.value}/merge`,
      {
        method: 'POST',
        body: { strategy, commitTitle, commitMessage, sha },
      },
    )
  }

  const markingReady = ref(false)

  async function markReady(number: number) {
    markingReady.value = true
    try {
      await $fetch(`/api/repository/${owner.value}/${repo.value}/pulls/${number}/ready`, {
        method: 'POST',
      })
      return true
    }
    catch {
      return false
    }
    finally {
      markingReady.value = false
    }
  }

  return { status, loading, error, fetch, merge, markingReady: readonly(markingReady), markReady }
}
