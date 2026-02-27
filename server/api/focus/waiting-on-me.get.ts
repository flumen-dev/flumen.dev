import type { WaitingOnMeItem, WaitingOnMeResponse } from '~~/shared/types/waiting-on-me'

// --- GraphQL queries ---

const REVIEW_REQUESTED_QUERY = /* GraphQL */ `
  query ReviewRequested($query: String!) {
    search(query: $query, type: ISSUE, first: 30) {
      nodes {
        ... on PullRequest {
          number
          title
          url
          createdAt
          updatedAt
          isDraft
          additions
          deletions
          repository { nameWithOwner }
          author { login avatarUrl }
          labels(first: 5) { nodes { name color } }
          comments { totalCount }
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        }
      }
    }
  }
`

const ASSIGNED_ISSUES_QUERY = /* GraphQL */ `
  query AssignedIssues($query: String!) {
    search(query: $query, type: ISSUE, first: 50) {
      nodes {
        ... on Issue {
          number
          title
          url
          createdAt
          updatedAt
          repository { nameWithOwner viewerPermission }
          author { login avatarUrl }
          labels(first: 5) { nodes { name color } }
          comments { totalCount }
          lastComments: comments(last: 1) {
            nodes {
              author { login avatarUrl }
              createdAt
            }
          }
        }
      }
    }
  }
`

const CHANGES_REQUESTED_QUERY = /* GraphQL */ `
  query ChangesRequested($query: String!) {
    search(query: $query, type: ISSUE, first: 30) {
      nodes {
        ... on PullRequest {
          number
          title
          url
          createdAt
          updatedAt
          isDraft
          additions
          deletions
          repository { nameWithOwner }
          author { login avatarUrl }
          labels(first: 5) { nodes { name color } }
          comments { totalCount }
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
          reviews(last: 5, states: [CHANGES_REQUESTED]) {
            nodes {
              author { login avatarUrl }
              createdAt
            }
          }
        }
      }
    }
  }
`

// --- Types for raw GraphQL responses ---

interface GQLAuthor {
  login: string
  avatarUrl: string
}

interface GQLLabel {
  name: string
  color: string
}

interface PRExtras {
  isDraft: boolean
  additions: number
  deletions: number
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> }
}

interface ReviewRequestedNode extends PRExtras {
  number: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  repository: { nameWithOwner: string }
  author: GQLAuthor
  labels: { nodes: GQLLabel[] }
  comments: { totalCount: number }
}

interface AssignedIssueNode {
  number: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  repository: { nameWithOwner: string, viewerPermission: string }
  author: GQLAuthor
  labels: { nodes: GQLLabel[] }
  comments: { totalCount: number }
  lastComments: {
    nodes: Array<{
      author: GQLAuthor | null
      createdAt: string
    }>
  }
}

interface ChangesRequestedNode extends PRExtras {
  number: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  repository: { nameWithOwner: string }
  author: GQLAuthor
  labels: { nodes: GQLLabel[] }
  comments: { totalCount: number }
  reviews: {
    nodes: Array<{
      author: GQLAuthor | null
      createdAt: string
    }>
  }
}

function extractCIStatus(node: PRExtras): WaitingOnMeItem['ciStatus'] {
  const rollup = node.commits.nodes[0]?.commit.statusCheckRollup
  return (rollup?.state as WaitingOnMeItem['ciStatus']) ?? null
}

function daysBetween(from: string, to: Date): number {
  const ms = to.getTime() - new Date(from).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

const fetchWaitingOnMe = defineCachedFunction(
  async (token: string, login: string): Promise<WaitingOnMeResponse> => {
    const now = new Date()

    const [reviewData, assignedData, changesData] = await Promise.all([
      githubGraphQL<{ search: { nodes: ReviewRequestedNode[] } }>(
        token,
        REVIEW_REQUESTED_QUERY,
        { query: `is:pr is:open review-requested:${login}` },
      ),
      githubGraphQL<{ search: { nodes: AssignedIssueNode[] } }>(
        token,
        ASSIGNED_ISSUES_QUERY,
        { query: `is:issue is:open assignee:${login}` },
      ),
      githubGraphQL<{ search: { nodes: ChangesRequestedNode[] } }>(
        token,
        CHANGES_REQUESTED_QUERY,
        { query: `is:pr is:open author:${login} review:changes_requested` },
      ),
    ])

    const items: WaitingOnMeItem[] = []
    const loginLower = login.toLowerCase()

    // 1. PRs where I'm requested as reviewer
    for (const node of reviewData.search.nodes) {
      if (!node.number) continue
      items.push({
        category: 'review-requested',
        type: 'pr',
        number: node.number,
        title: node.title,
        url: node.url,
        repo: node.repository.nameWithOwner,
        createdAt: node.createdAt,
        waitingSince: node.updatedAt,
        waitingDays: daysBetween(node.updatedAt, now),
        commentsCount: node.comments.totalCount,
        isDraft: node.isDraft,
        additions: node.additions,
        deletions: node.deletions,
        ciStatus: extractCIStatus(node),
        author: node.author,
        requester: node.author,
        labels: node.labels.nodes,
      })
    }

    // 2. Issues assigned to me where last comment is not from me
    //    Only if I'm a maintainer (ADMIN/MAINTAIN/WRITE) — contributors don't block
    const maintainerPerms = new Set(['ADMIN', 'MAINTAIN', 'WRITE'])
    for (const node of assignedData.search.nodes) {
      if (!node.number) continue
      if (!maintainerPerms.has(node.repository.viewerPermission)) continue
      const lastComment = node.lastComments.nodes[0]
      const lastCommentAuthor = lastComment?.author?.login?.toLowerCase()

      if (lastCommentAuthor === loginLower) continue

      const waitingSince = lastComment?.createdAt ?? node.createdAt
      const requester = lastComment?.author ?? node.author

      items.push({
        category: 'needs-response',
        type: 'issue',
        number: node.number,
        title: node.title,
        url: node.url,
        repo: node.repository.nameWithOwner,
        createdAt: node.createdAt,
        waitingSince,
        waitingDays: daysBetween(waitingSince, now),
        commentsCount: node.comments.totalCount,
        isDraft: null,
        additions: null,
        deletions: null,
        ciStatus: null,
        author: node.author,
        requester,
        labels: node.labels.nodes,
      })
    }

    // 3. My PRs with changes requested
    for (const node of changesData.search.nodes) {
      if (!node.number) continue
      const lastReview = node.reviews.nodes[node.reviews.nodes.length - 1]
      if (!lastReview) continue

      const requester = lastReview.author ?? node.author

      items.push({
        category: 'changes-requested',
        type: 'pr',
        number: node.number,
        title: node.title,
        url: node.url,
        repo: node.repository.nameWithOwner,
        createdAt: node.createdAt,
        waitingSince: lastReview.createdAt,
        waitingDays: daysBetween(lastReview.createdAt, now),
        commentsCount: node.comments.totalCount,
        isDraft: node.isDraft,
        additions: node.additions,
        deletions: node.deletions,
        ciStatus: extractCIStatus(node),
        author: node.author,
        requester,
        labels: node.labels.nodes,
      })
    }

    items.sort((a, b) => new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime())

    const uniquePeople = new Set(items.map(i => i.requester.login))
    const totalDays = items.reduce((sum, i) => sum + i.waitingDays, 0)

    return {
      items,
      summary: {
        totalItems: items.length,
        uniquePeopleBlocked: uniquePeople.size,
        averageWaitDays: items.length > 0 ? Math.round(totalDays / items.length) : 0,
      },
    }
  },
  {
    maxAge: 60 * 5,
    name: 'waiting-on-me',
    getKey: (_token: string, login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  return fetchWaitingOnMe(token, login)
})
