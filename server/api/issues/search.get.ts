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

function escapeGitHubQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export default defineEventHandler(async (event): Promise<Issue[]> => {
  const { token, login } = await getSessionToken(event)
  const { repo, state = 'open', q, assignedToMe, unassigned, label, milestone, author, assignee } = getQuery<{
    repo?: string
    state?: string
    q?: string
    assignedToMe?: string
    unassigned?: string
    label?: string
    milestone?: string
    author?: string
    assignee?: string
  }>(event)

  if (!repo || !q || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo/q query parameter' })
  }

  const isAssignedToMe = assignedToMe === '1' || assignedToMe === 'true'
  const isUnassigned = unassigned === '1' || unassigned === 'true'

  if (isAssignedToMe && isUnassigned) {
    throw createError({ statusCode: 400, message: 'assignedToMe and unassigned are mutually exclusive' })
  }

  const stateQ = state === 'closed' ? 'is:closed' : 'is:open'
  const escapedQ = escapeGitHubQuery(q)
  let query = `is:issue ${stateQ} repo:${repo} ${escapedQ} in:title,body sort:updated-desc`
  if (isAssignedToMe) query += ` assignee:${login}`
  if (isUnassigned) query += ` no:assignee`
  if (milestone === '*') {
    query += ` milestone:*`
  }
  else if (milestone) {
    query += ` milestone:"${escapeGitHubQuery(String(milestone))}"`
  }
  if (label) {
    for (const l of String(label).split(',')) {
      if (l.trim()) query += ` label:"${escapeGitHubQuery(l.trim())}"`
    }
  }
  const LOGIN_RE = /^(?!.*--)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/
  if (author && LOGIN_RE.test(String(author))) query += ` author:${author}`
  if (assignee && LOGIN_RE.test(String(assignee))) query += ` assignee:${assignee}`

  const data = await githubGraphQL<MinimalSearchResult>(token, MINIMAL_SEARCH_QUERY, {
    query,
    first: 30,
  })

  const minimalNodes = data.search.nodes.filter(
    (n): n is MinimalIssueNode => n !== null && 'id' in n,
  )

  return getOrFetchIssues(token, login, minimalNodes)
})
