import type { WorkItemsPageResponse } from '~~/shared/types/work-item'
import { getRepoWorkItemsForRequest, getRepoWorkItemsSyncSnapshot } from '~~/server/utils/repo-sync-service'
import { applyWorkItemsQuery, parseWorkItemFilters, resolveWorkItemsSort } from '~~/server/utils/work-items-query'
import { getRepoParams } from '~~/server/utils/github'

export default defineEventHandler(async (event) => {
  const { owner, repo } = getRepoParams(event)
  const query = getQuery(event)
  const stateParam = query.state
  const limitParam = Number(query.limit)
  const firstParam = Number(query.first)
  const afterParam = query.after
  const searchParam = query.search as string | undefined
  const filtersParam = query.filters as string | undefined
  const sortParam = query.sort as string | undefined

  const state: 'open' | 'closed' | 'all' = stateParam === 'closed' || stateParam === 'all' ? stateParam : 'open'
  const hasCursorPagination = query.first !== undefined || query.after !== undefined

  const allItems = await getRepoWorkItemsForRequest(event, owner, repo, state)
  const queryResult = applyWorkItemsQuery(allItems, {
    search: searchParam,
    filters: parseWorkItemFilters(filtersParam),
    sort: resolveWorkItemsSort(sortParam),
  })

  if (hasCursorPagination) {
    const pageSize = Number.isFinite(firstParam) && firstParam > 0
      ? Math.min(Math.floor(firstParam), 100)
      : 30
    const cursorValue = afterParam !== undefined ? Number(afterParam) : NaN
    const page = Number.isFinite(cursorValue) && cursorValue >= 0 ? cursorValue + 1 : 1

    const start = (page - 1) * pageSize
    const end = start + pageSize
    const items = queryResult.items.slice(start, end)
    const sync = await getRepoWorkItemsSyncSnapshot(owner, repo)
    const hasNextPage = end < queryResult.items.length || (sync.isPartial && sync.status === 'running' && items.length > 0)

    const response: WorkItemsPageResponse = {
      items,
      totalCount: queryResult.items.length,
      pageInfo: {
        hasNextPage,
        endCursor: hasNextPage ? String(page) : null,
      },
      sync,
      availableLabels: queryResult.availableLabels,
    }

    return response
  }

  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(Math.floor(limitParam), 100)
    : 30

  return queryResult.items.slice(0, limit)
})