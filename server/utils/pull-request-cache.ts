import type { MinimalPullRequestNode, PullRequest } from '~~/shared/types/pull-request'
import type { GraphQLPullRequestNode } from '~~/shared/utils/pull-request'
import { toPullRequest } from '~~/shared/utils/pull-request'

const PR_FIELDS = `
  id
  number
  title
  state
  isDraft
  url
  createdAt
  updatedAt
  closedAt
  mergedAt
  additions
  deletions
  changedFiles
  headRefName
  baseRefName
  mergeable
  reviewDecision
  author { login avatarUrl }
  labels(first: 10) { nodes { name color } }
  assignees(first: 5) { nodes { login avatarUrl } }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User { login avatarUrl }
      }
    }
  }
  comments { totalCount }
  closingIssuesReferences(first: 0) { totalCount }
  latestReviews(first: 10) {
    nodes {
      state
      author { login avatarUrl }
    }
  }
  commits(last: 1) {
    nodes {
      commit { statusCheckRollup { state } }
    }
  }
  repository { nameWithOwner name owner { login } }
`

const NODES_QUERY = `
query($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on PullRequest {
      ${PR_FIELDS}
    }
  }
}
`

interface CachedPullRequestNode {
  updatedAt: string
  node: GraphQLPullRequestNode
}

/**
 * Given minimal PR nodes (id + updatedAt), resolves full PullRequest objects
 * using Nitro storage as cache. Pattern mirrors getOrFetchIssues.
 */
export async function getOrFetchPullRequests(
  token: string,
  minimalNodes: MinimalPullRequestNode[],
): Promise<PullRequest[]> {
  if (!minimalNodes.length) return []

  const storage = useStorage('data')
  const resolvedNodes: GraphQLPullRequestNode[] = []
  const missingIds: string[] = []

  const cacheChecks = await Promise.all(
    minimalNodes.map(async (node) => {
      const cached = await storage.getItem<CachedPullRequestNode>(`pull-requests:${node.id}`)
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

  if (missingIds.length) {
    const data = await githubGraphQL<{ nodes: (GraphQLPullRequestNode | null)[] }>(
      token,
      NODES_QUERY,
      { ids: missingIds },
    )

    const freshNodes = data.nodes.filter(
      (n): n is GraphQLPullRequestNode => n !== null && 'id' in n,
    )

    await Promise.all(
      freshNodes.map(async (node) => {
        await storage.setItem<CachedPullRequestNode>(`pull-requests:${node.id}`, {
          updatedAt: node.updatedAt,
          node,
        })
      }),
    )

    resolvedNodes.push(...freshNodes)
  }

  const prs = resolvedNodes.filter(Boolean).map(n => toPullRequest(n))

  const orderMap = new Map(minimalNodes.map((n, i) => [n.id, i]))
  prs.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))

  return prs
}
