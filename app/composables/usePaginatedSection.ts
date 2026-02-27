import type { PaginatedResponse } from '~~/shared/types/pagination'

const STALE_MS = 2 * 60 * 1000 // 2 minutes

export interface PaginatedSection<T> {
  data: Ref<T[]>
  loading: Ref<boolean>
  error: Ref<boolean>
  fetchedAt: Ref<number | null>
  totalCount: Ref<number>
  hasMore: ComputedRef<boolean>
  hasPrevious: ComputedRef<boolean>
  currentPage: ComputedRef<number>
  totalPages: ComputedRef<number>
  paging: Ref<'next' | 'prev' | null>
  fetch: (after?: string | null) => Promise<boolean>
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
  refresh: () => Promise<void>
  resetPagination: () => void
  isStale: () => boolean
}

export function usePaginatedSection<T>(
  apiFetch: ReturnType<typeof useRequestFetch>,
  endpoint: string,
  pageSize: number,
  buildParams: () => Record<string, string | number>,
): PaginatedSection<T> {
  const data = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const error = ref(false)
  const fetchedAt = ref<number | null>(null)
  const totalCount = ref(0)
  const endCursor = ref<string | null>(null)
  const _hasMore = ref(false)
  const cursorHistory = ref<string[]>([])
  const paging = ref<'next' | 'prev' | null>(null)

  // Page cache — keyed by cursor (null → '__first__')
  const pageCache = new Map<string, { items: T[], endCursor: string | null, hasMore: boolean, totalCount: number }>()
  function cacheKey(cursor?: string | null) {
    return cursor ?? '__first__'
  }

  const hasMore = computed(() => _hasMore.value)
  const hasPrevious = computed(() => cursorHistory.value.length > 0)
  const currentPage = computed(() => cursorHistory.value.length + 1)
  const totalPages = computed(() => Math.ceil(totalCount.value / pageSize))

  function isStale(): boolean {
    if (!fetchedAt.value) return true
    return Date.now() - fetchedAt.value > STALE_MS
  }

  function applyCached(key: string): boolean {
    const cached = pageCache.get(key)
    if (!cached) return false
    data.value = cached.items
    endCursor.value = cached.endCursor
    _hasMore.value = cached.hasMore
    totalCount.value = cached.totalCount
    return true
  }

  async function fetchData(after?: string | null): Promise<boolean> {
    loading.value = true
    error.value = false
    try {
      const params: Record<string, string | number> = { ...buildParams(), first: pageSize }
      if (after) params.after = after

      const res = await apiFetch<PaginatedResponse<T>>(endpoint, { params })
      data.value = res.items
      fetchedAt.value = Date.now()
      totalCount.value = res.totalCount
      _hasMore.value = res.pageInfo.hasNextPage
      endCursor.value = res.pageInfo.endCursor

      pageCache.set(cacheKey(after), {
        items: res.items,
        endCursor: res.pageInfo.endCursor,
        hasMore: res.pageInfo.hasNextPage,
        totalCount: res.totalCount,
      })

      return true
    }
    catch {
      error.value = true
      return false
    }
    finally {
      loading.value = false
    }
  }

  async function nextPage() {
    if (!_hasMore.value || !endCursor.value) return
    const cursor = endCursor.value
    paging.value = 'next'
    try {
      if (applyCached(cacheKey(cursor))) {
        cursorHistory.value.push(cursor)
      }
      else if (await fetchData(cursor)) {
        cursorHistory.value.push(cursor)
      }
    }
    finally {
      paging.value = null
    }
  }

  async function prevPage() {
    if (!cursorHistory.value.length) return
    const prevCursor = cursorHistory.value.slice(0, -1).at(-1) ?? null
    paging.value = 'prev'
    try {
      if (applyCached(cacheKey(prevCursor))) {
        cursorHistory.value.pop()
      }
      else if (await fetchData(prevCursor)) {
        cursorHistory.value.pop()
      }
    }
    finally {
      paging.value = null
    }
  }

  async function refresh() {
    pageCache.clear()
    const prevHistory = cursorHistory.value
    cursorHistory.value = []
    if (!await fetchData()) {
      cursorHistory.value = prevHistory
    }
  }

  function resetPagination() {
    paging.value = null
    cursorHistory.value = []
    _hasMore.value = false
    endCursor.value = null
    pageCache.clear()
  }

  return {
    data,
    loading,
    error,
    fetchedAt,
    totalCount,
    hasMore,
    hasPrevious,
    currentPage,
    totalPages,
    paging,
    fetch: fetchData,
    nextPage,
    prevPage,
    refresh,
    resetPagination,
    isStale,
  }
}
