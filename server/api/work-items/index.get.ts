import type { WorkItemsPageResponse } from '~~/shared/types/work-item'
import { getRepoWorkItemsForRequest, getRepoWorkItemsSyncSnapshot } from '~~/server/utils/repo-sync-service'
import { applyWorkItemsQuery, parseWorkItemFilters, resolveWorkItemsSort } from '~~/server/utils/work-items-query'

export default defineEventHandler(async (event): Promise<WorkItemsPageResponse> => {
  const { state = 'open', repo, first = '20', after, search, filters, sort } = getQuery<{
    state?: string
    repo?: string
    first?: string
    after?: string
    search?: string
    filters?: string
    sort?: string
  }>(event)

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const [owner, repoName] = repo.split('/')
  const resolvedState: 'open' | 'closed' | 'all' = state === 'closed' || state === 'all' ? state : 'open'
  const pageSize = Math.min(Math.max(Number(first) || 20, 1), 100)
  const cursorValue = after !== undefined ? Number(after) : NaN
  const page = Number.isFinite(cursorValue) && cursorValue >= 0 ? cursorValue + 1 : 1

  const allItems = await getRepoWorkItemsForRequest(event, owner!, repoName!, resolvedState)
  const queryResult = applyWorkItemsQuery(allItems, {
    search,
    filters: parseWorkItemFilters(filters),
    sort: resolveWorkItemsSort(sort),
  })
  const sync = await getRepoWorkItemsSyncSnapshot(owner!, repoName!)

  const start = (page - 1) * pageSize
  const end = start + pageSize
  const items = queryResult.items.slice(start, end)
  const hasNextPage = end < queryResult.items.length || (sync.isPartial && sync.status === 'running' && items.length > 0)

  return {
    items,
    totalCount: queryResult.items.length,
    pageInfo: {
      hasNextPage,
      endCursor: hasNextPage ? String(page) : null,
    },
    sync,
    availableLabels: queryResult.availableLabels,
  }
})
