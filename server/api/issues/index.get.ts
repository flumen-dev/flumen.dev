import type { GraphQLIssueSearchResult, GraphQLIssueNode, Issue } from '~~/shared/types/issue'
import { toIssue } from '~~/shared/utils/issue'

const ISSUES_QUERY = `
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
        title
        state
        stateReason
        url
        createdAt
        updatedAt
        closedAt
        author { login avatarUrl }
        labels(first: 10) { nodes { name color } }
        assignees(first: 5) { nodes { login avatarUrl } }
        milestone { title }
        comments { totalCount }
        timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], first: 0) { totalCount }
        repository { nameWithOwner name owner { login } }
      }
    }
  }
}
`

const fetchIssues = defineCachedFunction(
  async (_login: string, token: string, state: string, repo: string): Promise<Issue[]> => {
    const stateQ = state === 'closed' ? 'is:closed' : 'is:open'
    const query = `is:issue ${stateQ} repo:${repo} sort:updated-desc`
    const issues: Issue[] = []
    let after: string | null = null

    // Paginate up to 5 pages (500 issues)
    for (let page = 0; page < 5; page++) {
      const data: GraphQLIssueSearchResult = await githubGraphQL<GraphQLIssueSearchResult>(token, ISSUES_QUERY, {
        query,
        first: 100,
        after,
      })

      const nodes = data.search.nodes.filter((n: GraphQLIssueNode | null): n is GraphQLIssueNode => n !== null && 'id' in n)
      issues.push(...nodes.map(toIssue))

      if (!data.search.pageInfo.hasNextPage) break
      after = data.search.pageInfo.endCursor
    }

    return issues
  },
  {
    maxAge: 60,
    name: 'issues-list',
    getKey: (login: string, _token: string, state: string, repo: string) => `${login}:${state}:${repo}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { state = 'open', repo } = getQuery<{ state?: string, repo?: string }>(event)

  if (!repo) {
    throw createError({ statusCode: 400, message: 'Missing repo query parameter' })
  }

  return fetchIssues(login, token, state, repo)
})
