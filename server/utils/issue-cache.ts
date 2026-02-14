import type { MinimalIssueNode, GraphQLIssueNode, Issue } from '~~/shared/types/issue'
import { toIssue } from '~~/shared/utils/issue'

const ISSUE_FIELDS = `
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
  comments(first: 5) { totalCount nodes { author { login } } }
  timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], first: 0) { totalCount }
  repository { nameWithOwner name owner { login } }
`

const NODES_QUERY = `
query($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Issue {
      ${ISSUE_FIELDS}
    }
  }
}
`

interface CachedIssue {
  updatedAt: string
  issue: Issue
}

/**
 * Given minimal issue nodes (id + updatedAt), resolves full Issue objects
 * using Nitro storage as cache. Only fetches from GitHub for cache misses
 * or stale entries.
 */
export async function getOrFetchIssues(
  token: string,
  login: string,
  minimalNodes: MinimalIssueNode[],
): Promise<Issue[]> {
  if (!minimalNodes.length) return []

  const storage = useStorage('data')
  const issues: Issue[] = []
  const missingIds: string[] = []

  // Check cache for each issue
  const cacheChecks = await Promise.all(
    minimalNodes.map(async (node) => {
      const cached = await storage.getItem<CachedIssue>(`issues:${node.id}`)
      return { node, cached }
    }),
  )

  for (const { node, cached } of cacheChecks) {
    if (cached && cached.updatedAt === node.updatedAt) {
      issues.push(cached.issue)
    }
    else {
      missingIds.push(node.id)
    }
  }

  // Fetch cache misses in batch via nodes() query
  if (missingIds.length) {
    const data = await githubGraphQL<{ nodes: (GraphQLIssueNode | null)[] }>(
      token,
      NODES_QUERY,
      { ids: missingIds },
    )

    const freshIssues = data.nodes
      .filter((n): n is GraphQLIssueNode => n !== null && 'id' in n)
      .map(n => toIssue(n, login))

    // Store in cache and collect
    await Promise.all(
      freshIssues.map(async (issue) => {
        await storage.setItem<CachedIssue>(`issues:${issue.id}`, {
          updatedAt: issue.updatedAt,
          issue,
        })
      }),
    )

    issues.push(...freshIssues)
  }

  // Return in the same order as the input
  const orderMap = new Map(minimalNodes.map((n, i) => [n.id, i]))
  issues.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))

  return issues
}
