import type { LinkedIssue } from '~~/shared/types/linked-issue'

/**
 * Tracks which PR rows are expanded to show their linked issues, plus a
 * shared cache so we don't refetch when a row is collapsed and reopened.
 */
export const useLinkedIssuesStore = defineStore('linkedIssues', () => {
  const apiFetch = useRequestFetch()

  const expanded = ref<Set<string>>(new Set())
  const cache = ref<Map<string, LinkedIssue[]>>(new Map())
  const loading = ref<Set<string>>(new Set())

  function isExpanded(prId: string): boolean {
    return expanded.value.has(prId)
  }

  function isLoading(prId: string): boolean {
    return loading.value.has(prId)
  }

  function items(prId: string): LinkedIssue[] {
    return cache.value.get(prId) ?? []
  }

  async function toggle(prId: string, repo: string, number: number) {
    if (expanded.value.has(prId)) {
      expanded.value = new Set([...expanded.value].filter(id => id !== prId))
      return
    }
    expanded.value = new Set([...expanded.value, prId])

    if (cache.value.has(prId) || loading.value.has(prId)) return

    loading.value = new Set([...loading.value, prId])
    try {
      const [owner, name] = repo.split('/')
      const data = await apiFetch<LinkedIssue[]>(
        `/api/repository/${owner}/${name}/pulls/${number}/linked-issues`,
      )
      cache.value.set(prId, data)
    }
    catch {
      // Leave cache untouched so the next toggle retries instead of showing a
      // stale empty state forever.
    }
    finally {
      loading.value = new Set([...loading.value].filter(id => id !== prId))
    }
  }

  return { isExpanded, isLoading, items, toggle }
})
