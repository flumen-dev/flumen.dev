import type { PageInfo } from '~~/shared/types/pagination'

interface PaginatedResponse<T> {
  items: T[]
  totalCount: number
  pageInfo: PageInfo
}

/**
 * Owns paginated state for a single highlight card (ready-to-merge,
 * reviews-requested, assigned-to-me, etc.). Cursor-stack pagination, monotonic
 * request id to ignore stale responses, generic over the row type.
 *
 * Used by stores — call this inside a Pinia setup function so refs survive
 * across the store instance.
 */
export function useHighlightSection<T>(endpoint: string, pageSize: number) {
  const apiFetch = useRequestFetch()

  const items = shallowRef<T[]>([])
  const totalCount = ref<number | null>(null)
  const cursorStack = ref<(string | null)[]>([null])
  const nextCursor = ref<string | null>(null)
  const hasMore = ref(false)
  const loading = ref(false)
  const paging = ref<'next' | 'prev' | null>(null)

  const currentPage = computed(() => Math.max(1, cursorStack.value.length))
  const hasPrevious = computed(() => currentPage.value > 1)
  const totalPages = computed(() => {
    if (totalCount.value === null) return 1
    return Math.max(1, Math.ceil(totalCount.value / pageSize))
  })

  function reset() {
    items.value = []
    totalCount.value = null
    cursorStack.value = [null]
    nextCursor.value = null
    hasMore.value = false
  }

  // Monotonic request id — only the most recent fetch is allowed to mutate
  // observable state. Protects against stale responses winning when the user
  // switches repos / pages quickly.
  let fetchSeq = 0

  async function fetchPage(repo: string) {
    const id = ++fetchSeq
    loading.value = true
    try {
      const after = cursorStack.value[cursorStack.value.length - 1]
      const response = await apiFetch<PaginatedResponse<T>>(endpoint, {
        params: { repo, first: pageSize, after: after ?? undefined },
      })
      if (id !== fetchSeq) return
      items.value = response.items
      totalCount.value = response.totalCount
      hasMore.value = response.pageInfo.hasNextPage
      nextCursor.value = response.pageInfo.endCursor
    }
    catch {
      if (id !== fetchSeq) return
      // Highlights are an enhancement — fail silently, leave empty.
      reset()
    }
    finally {
      if (id === fetchSeq) loading.value = false
    }
  }

  async function loadNext(repo: string) {
    if (!hasMore.value || paging.value || !nextCursor.value) return
    paging.value = 'next'
    try {
      cursorStack.value.push(nextCursor.value)
      await fetchPage(repo)
    }
    finally {
      paging.value = null
    }
  }

  async function loadPrevious(repo: string) {
    if (!hasPrevious.value || paging.value) return
    paging.value = 'prev'
    try {
      cursorStack.value.pop()
      await fetchPage(repo)
    }
    finally {
      paging.value = null
    }
  }

  return {
    items,
    totalCount,
    hasMore,
    hasPrevious,
    paging,
    loading,
    currentPage,
    totalPages,
    fetchPage,
    loadNext,
    loadPrevious,
    reset,
  }
}
