import type { PullRequest } from '~~/shared/types/pull-request'

export type PrStateFilter = 'open' | 'closed' | 'merged'

const PAGE_SIZE = 20
const HIGHLIGHT_PAGE_SIZE = HIGHLIGHT_CARD_VISIBLE_ITEMS

export const usePullRequestStore = defineStore('pullRequests', () => {
  const apiFetch = useRequestFetch()

  const selectedRepo = ref<string | null>(null)
  const stateFilter = ref<PrStateFilter>('open')
  const errorKey = ref<string | null>(null)

  const mainList = usePaginatedSection<PullRequest>(
    apiFetch,
    '/api/pull-requests',
    PAGE_SIZE,
    () => ({ repo: selectedRepo.value ?? '', state: stateFilter.value }),
  )

  const readyToMerge = usePaginatedSection<PullRequest>(
    apiFetch,
    '/api/pull-requests/ready-to-merge',
    HIGHLIGHT_PAGE_SIZE,
    () => ({ repo: selectedRepo.value ?? '' }),
  )

  const reviewsRequested = usePaginatedSection<PullRequest>(
    apiFetch,
    '/api/pull-requests/reviews-requested',
    HIGHLIGHT_PAGE_SIZE,
    () => ({ repo: selectedRepo.value ?? '' }),
  )

  const loaded = computed(() => mainList.fetchedAt.value !== null)

  async function fetchAll() {
    if (!selectedRepo.value) return
    errorKey.value = null
    const tasks: Array<Promise<unknown>> = [mainList.refresh()]
    if (stateFilter.value === 'open') {
      tasks.push(readyToMerge.refresh(), reviewsRequested.refresh())
    }
    else {
      readyToMerge.resetPagination()
      reviewsRequested.resetPagination()
    }
    await Promise.all(tasks)
    if (mainList.error.value) errorKey.value = 'generic'
  }

  async function selectRepo(repo: string) {
    if (repo === selectedRepo.value && loaded.value) return
    selectedRepo.value = repo
    await fetchAll()
  }

  async function setStateFilter(state: PrStateFilter) {
    if (stateFilter.value === state) return
    stateFilter.value = state
    await fetchAll()
  }

  async function refresh() {
    await fetchAll()
  }

  return {
    selectedRepo,
    stateFilter,
    errorKey,
    loaded,
    mainList,
    readyToMerge,
    reviewsRequested,
    selectRepo,
    setStateFilter,
    refresh,
  }
})
