import type { MinimalIssueNode } from '~~/shared/types/issue'

const MINIMAL_SEARCH_QUERY = `
query($query: String!, $first: Int!, $after: String) {
  search(query: $query, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
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

export interface IssueSearchPage {
  totalCount: number
  pageInfo: { hasNextPage: boolean, endCursor: string | null }
  minimalNodes: MinimalIssueNode[]
}

/**
 * Run a GitHub search query for issues and return minimal nodes plus
 * pagination info. The caller resolves full Issue objects via `getOrFetchIssues`.
 */
export async function searchIssues(
  token: string,
  query: string,
  options: { first: number, after?: string | null },
): Promise<IssueSearchPage> {
  const data = await githubGraphQL<MinimalSearchResult>(token, MINIMAL_SEARCH_QUERY, {
    query,
    first: options.first,
    after: options.after ?? null,
  })

  const minimalNodes = data.search.nodes.filter(
    (n): n is MinimalIssueNode => n !== null && 'id' in n,
  )

  return {
    totalCount: data.search.issueCount,
    pageInfo: data.search.pageInfo,
    minimalNodes,
  }
}
