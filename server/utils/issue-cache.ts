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

interface CachedIssueNode {
  updatedAt: string
  node: GraphQLIssueNode
}

/**
 * Given minimal issue nodes (id + updatedAt), resolves full Issue objects
 * using Nitro storage as cache. Stores raw GraphQL nodes so that
 * user-specific fields (maintainerCommented) are computed per-request.
 */
export async function getOrFetchIssues(
  token: string,
  login: string,
  minimalNodes: MinimalIssueNode[],
): Promise<Issue[]> {
  if (!minimalNodes.length) return []

  const storage = useStorage('data')
  const resolvedNodes: GraphQLIssueNode[] = []
  const missingIds: string[] = []

  // Check cache for each issue
  const cacheChecks = await Promise.all(
    minimalNodes.map(async (node) => {
      const cached = await storage.getItem<CachedIssueNode>(`issues:${node.id}`)
      return { node, cached }
    }),
  )

  for (const { node, cached } of cacheChecks) {
    if (cached && cached.node && cached.updatedAt === node.updatedAt) {
      resolvedNodes.push(cached.node)
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

    const freshNodes = data.nodes.filter(
      (n): n is GraphQLIssueNode => n !== null && 'id' in n,
    )

    // Store raw nodes in cache
    await Promise.all(
      freshNodes.map(async (node) => {
        await storage.setItem<CachedIssueNode>(`issues:${node.id}`, {
          updatedAt: node.updatedAt,
          node,
        })
      }),
    )

    resolvedNodes.push(...freshNodes)
  }

  // Convert to Issue with per-user maintainerCommented (skip any undefined nodes)
  const issues = resolvedNodes.filter(Boolean).map(n => toIssue(n, login))

  // Return in the same order as the input
  const orderMap = new Map(minimalNodes.map((n, i) => [n.id, i]))
  issues.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))

  return issues
}
