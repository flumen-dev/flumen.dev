import type { PullRequestListResponse } from '~~/shared/types/pull-request'

export default defineEventHandler(async (event): Promise<PullRequestListResponse> => {
  const { token } = await getSessionToken(event)
  const { state = 'open', repo, first = '20', after } = getQuery<{
    state?: string
    repo?: string
    first?: string
    after?: string
  }>(event)

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const pageSize = Math.min(Math.max(Number(first) || 20, 1), 100)
  const stateQ = state === 'closed' ? 'is:closed' : state === 'merged' ? 'is:merged' : 'is:open'
  const query = `is:pr ${stateQ} repo:${repo} sort:updated-desc`

  const page = await searchPullRequests(token, query, { first: pageSize, after })
  const items = await getOrFetchPullRequests(token, page.minimalNodes)

  return {
    items,
    totalCount: page.totalCount,
    pageInfo: page.pageInfo,
  }
})
