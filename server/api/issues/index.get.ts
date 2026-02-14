import type { MinimalIssueNode, PaginatedIssues } from '~~/shared/types/issue'

const MINIMAL_SEARCH_QUERY = `
query($query: String!, $first: Int!, $after: String) {
  search(query: $query, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ... on Issue {
        id
        number
        updatedAt
        repository { nameWithOwner name owner { login } }
      }
    }
  }
}
`

interface MinimalSearchResult {
  search: {
    issueCount: number
    pageInfo: { hasNextPage: boolean, endCursor: string | null }
    nodes: (MinimalIssueNode | null)[]
  }
}

export default defineEventHandler(async (event): Promise<PaginatedIssues> => {
  const { token, login } = await getSessionToken(event)
  const { state = 'open', repo, first = '30', after } = getQuery<{
    state?: string
    repo?: string
    first?: string
    after?: string
  }>(event)

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const pageSize = Math.min(Math.max(Number(first) || 30, 1), 100)
  const stateQ = state === 'closed' ? 'is:closed' : 'is:open'
  const query = `is:issue ${stateQ} repo:${repo} sort:updated-desc`

  // 1. Lightweight search — only id, number, updatedAt
  const data = await githubGraphQL<MinimalSearchResult>(token, MINIMAL_SEARCH_QUERY, {
    query,
    first: pageSize,
    after: after || null,
  })

  const minimalNodes = data.search.nodes.filter(
    (n): n is MinimalIssueNode => n !== null && 'id' in n,
  )

  // 2. Cache-resolve: check storage, fetch misses in batch
  const issues = await getOrFetchIssues(token, login, minimalNodes)

  return {
    issues,
    totalCount: data.search.issueCount,
    pageInfo: data.search.pageInfo,
  }
})
