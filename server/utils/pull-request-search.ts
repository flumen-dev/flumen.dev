import type { MinimalPullRequestNode } from '~~/shared/types/pull-request'

const MINIMAL_SEARCH_QUERY = `
query($query: String!, $first: Int!, $after: String) {
  search(query: $query, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
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
    nodes: (MinimalPullRequestNode | null)[]
  }
}

export interface PullRequestSearchPage {
  totalCount: number
  pageInfo: { hasNextPage: boolean, endCursor: string | null }
  minimalNodes: MinimalPullRequestNode[]
}

/**
 * Run a GitHub search query for pull requests and return minimal nodes plus
 * pagination info. The caller resolves full PR objects via `getOrFetchPullRequests`.
 */
export async function searchPullRequests(
  token: string,
  query: string,
  options: { first: number, after?: string | null },
): Promise<PullRequestSearchPage> {
  const data = await githubGraphQL<MinimalSearchResult>(token, MINIMAL_SEARCH_QUERY, {
    query,
    first: options.first,
    after: options.after ?? null,
  })

  const minimalNodes = data.search.nodes.filter(
    (n): n is MinimalPullRequestNode => n !== null && 'id' in n,
  )

  return {
    totalCount: data.search.issueCount,
    pageInfo: data.search.pageInfo,
    minimalNodes,
  }
}
