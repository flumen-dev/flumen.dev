import type { PullRequestListResponse } from '~~/shared/types/pull-request'

export default defineEventHandler(async (event): Promise<PullRequestListResponse> => {
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
  const query = `is:pr is:open draft:false repo:${repo} review-requested:${login} sort:updated-desc`

  const page = await searchPullRequests(token, query, { first: pageSize, after })
  const items = await getOrFetchPullRequests(token, page.minimalNodes)

  return {
    items,
    totalCount: page.totalCount,
    pageInfo: page.pageInfo,
  }
})
