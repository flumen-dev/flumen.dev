import type { WorkItem } from '~~/shared/types/work-item'
import type { PaginatedResponse } from '~~/shared/types/pagination'
import { getRepoWorkItemsForRequest } from '~~/server/utils/repo-sync-service'

export default defineEventHandler(async (event): Promise<PaginatedResponse<WorkItem>> => {
  const { state = 'open', repo, first = '20', after } = getQuery<{
    state?: string
    repo?: string
    first?: string
    after?: string
  }>(event)

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const [owner, repoName] = repo.split('/')
  const resolvedState: 'open' | 'closed' = state === 'closed' ? 'closed' : 'open'
  const pageSize = Math.min(Math.max(Number(first) || 20, 1), 100)
  const page = after ? Number(after) + 1 : 1

  const allItems = await getRepoWorkItemsForRequest(event, owner!, repoName!, resolvedState)

  const start = (page - 1) * pageSize
  const end = start + pageSize
  const items = allItems.slice(start, end)
  const hasNextPage = end < allItems.length

  return {
    items,
    totalCount: allItems.length,
    pageInfo: {
      hasNextPage,
      endCursor: hasNextPage ? String(page) : null,
    },
  }
})
