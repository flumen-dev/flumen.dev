import type { Issue } from '~~/shared/types/issue'
import type { PaginatedResponse } from '~~/shared/types/pagination'

export default defineEventHandler(async (event): Promise<PaginatedResponse<Issue>> => {
  const { token, login } = await getSessionToken(event)
  const { repo, first = '12', after } = getQuery<{
    repo?: string
    first?: string
    after?: string
  }>(event)

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const pageSize = Math.min(Math.max(Number(first) || 12, 1), 50)
  const query = `is:issue is:open repo:${repo} author:${login} sort:updated-desc`

  const page = await searchIssues(token, query, { first: pageSize, after })
  const items = await getOrFetchIssues(token, login, page.minimalNodes)

  return {
    items,
    totalCount: page.totalCount,
    pageInfo: page.pageInfo,
  }
})
