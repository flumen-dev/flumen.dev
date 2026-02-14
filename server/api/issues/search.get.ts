import type { MinimalIssueNode, Issue } from '~~/shared/types/issue'

const MINIMAL_SEARCH_QUERY = `
query($query: String!, $first: Int!) {
  search(query: $query, type: ISSUE, first: $first) {
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
    nodes: (MinimalIssueNode | null)[]
  }
}

export default defineEventHandler(async (event): Promise<Issue[]> => {
  const { token, login } = await getSessionToken(event)
  const { repo, state = 'open', q } = getQuery<{
    repo?: string
    state?: string
    q?: string
  }>(event)

  if (!repo || !q || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo/q query parameter' })
  }

  const stateQ = state === 'closed' ? 'is:closed' : 'is:open'
  const query = `is:issue ${stateQ} repo:${repo} ${q} in:title sort:updated-desc`

  const data = await githubGraphQL<MinimalSearchResult>(token, MINIMAL_SEARCH_QUERY, {
    query,
    first: 30,
  })

  const minimalNodes = data.search.nodes.filter(
    (n): n is MinimalIssueNode => n !== null && 'id' in n,
  )

  return getOrFetchIssues(token, login, minimalNodes)
})
