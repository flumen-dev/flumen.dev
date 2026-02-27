import type { Issue, MinimalIssueNode } from '~~/shared/types/issue'
import type { PaginatedResponse } from '~~/shared/types/pagination'

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

export default defineEventHandler(async (event): Promise<PaginatedResponse<Issue>> => {
  const { token, login } = await getSessionToken(event)
  const { state = 'open', repo, first = '20', after, assignedToMe, unassigned, label, milestone } = getQuery<{
    state?: string
    repo?: string
    first?: string
    after?: string
    assignedToMe?: string
    unassigned?: string
    label?: string
    milestone?: string
  }>(event)

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const pageSize = Math.min(Math.max(Number(first) || 20, 1), 100)
  const stateQ = state === 'closed' ? 'is:closed' : 'is:open'
  let query = `is:issue ${stateQ} repo:${repo} sort:updated-desc`
  if (assignedToMe) query += ` assignee:${login}`
  if (unassigned) query += ` no:assignee`
  if (milestone) query += ` milestone:"${milestone}"`
  if (label) {
    for (const l of String(label).split(',')) {
      if (l.trim()) query += ` label:"${l.trim()}"`
    }
  }

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
    items: issues,
    totalCount: data.search.issueCount,
    pageInfo: data.search.pageInfo,
  }
})
