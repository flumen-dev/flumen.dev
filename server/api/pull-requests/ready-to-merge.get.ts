import type { PullRequestListResponse } from '~~/shared/types/pull-request'

export default defineEventHandler(async (event): Promise<PullRequestListResponse> => {
  const { token } = await getSessionToken(event)
  const { repo, first = '12', after } = getQuery<{
    repo?: string
    first?: string
    after?: string
  }>(event)

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const pageSize = Math.min(Math.max(Number(first) || 12, 1), 50)
  const query = `is:pr is:open draft:false repo:${repo} review:approved status:success sort:updated-desc`

  const page = await searchPullRequests(token, query, { first: pageSize, after })
  const resolved = await getOrFetchPullRequests(token, page.minimalNodes)

  // GitHub Search has no `mergeable` qualifier — drop conflicting PRs after the fact.
  const items = resolved.filter(pr => pr.mergeable !== 'CONFLICTING')

  return {
    items,
    totalCount: page.totalCount,
    pageInfo: page.pageInfo,
  }
})
