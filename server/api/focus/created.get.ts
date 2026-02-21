export interface CreatedIssuePR {
  number: number
  title: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  url: string
  author: { login: string, avatarUrl: string }
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  ciStatus: 'SUCCESS' | 'FAILURE' | 'PENDING' | null
}

export interface CreatedIssueItem {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  repo: string
  createdAt: string
  updatedAt: string
  labels: Array<{ name: string, color: string }>
  assignees: Array<{ login: string, avatarUrl: string }>
  commentCount: number
  reactions: ReactionSummary
  linkedPrs: CreatedIssuePR[]
  needsResponse: boolean
  lastCommentAuthor: string | null
  lastCommentAt: string | null
}

interface ReactionSummary {
  totalCount: number
  thumbsUp: number
  thumbsDown: number
  laugh: number
  hooray: number
  heart: number
  rocket: number
  eyes: number
  confused: number
}

const CREATED_ISSUES_QUERY = /* GraphQL */ `
  query CreatedIssues($query: String!, $first: Int!, $after: String) {
    search(query: $query, type: ISSUE, first: $first, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
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
          labels(first: 10) { nodes { name color } }
          assignees(first: 5) { nodes { login avatarUrl } }
          comments(last: 1) {
            totalCount
            nodes {
              author { login }
              createdAt
            }
          }
          reactions {
            totalCount
          }
          thumbsUp: reactions(content: THUMBS_UP) { totalCount }
          thumbsDown: reactions(content: THUMBS_DOWN) { totalCount }
          laugh: reactions(content: LAUGH) { totalCount }
          hooray: reactions(content: HOORAY) { totalCount }
          heart: reactions(content: HEART) { totalCount }
          rocket: reactions(content: ROCKET) { totalCount }
          eyes: reactions(content: EYES) { totalCount }
          confused: reactions(content: CONFUSED) { totalCount }
          timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], first: 10) {
            nodes {
              ... on CrossReferencedEvent {
                source {
                  ... on PullRequest {
                    number
                    title
                    state
                    isDraft
                    url
                    author { login avatarUrl }
                    reviewDecision
                    commits(last: 1) {
                      nodes {
                        commit {
                          statusCheckRollup {
                            state
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          repository { nameWithOwner }
        }
      }
    }
  }
`

interface GQLCreatedNode {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  createdAt: string
  updatedAt: string
  labels: { nodes: Array<{ name: string, color: string }> }
  assignees: { nodes: Array<{ login: string, avatarUrl: string }> }
  comments: {
    totalCount: number
    nodes: Array<{ author: { login: string } | null, createdAt: string }>
  }
  reactions: { totalCount: number }
  thumbsUp: { totalCount: number }
  thumbsDown: { totalCount: number }
  laugh: { totalCount: number }
  hooray: { totalCount: number }
  heart: { totalCount: number }
  rocket: { totalCount: number }
  eyes: { totalCount: number }
  confused: { totalCount: number }
  timelineItems: {
    nodes: Array<{
      source: {
        number?: number
        title?: string
        state?: 'OPEN' | 'CLOSED' | 'MERGED'
        isDraft?: boolean
        url?: string
        author?: { login: string, avatarUrl: string }
        reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
        commits?: {
          nodes: Array<{
            commit: {
              statusCheckRollup: { state: string } | null
            }
          }>
        }
      } | null
    }>
  }
  repository: { nameWithOwner: string }
}

export default defineEventHandler(async (event): Promise<PaginatedResponse<CreatedIssueItem>> => {
  const { token, login } = await getSessionToken(event)
  const { state = 'open', first = '20', after } = getQuery<{
    state?: string
    first?: string
    after?: string
  }>(event)

  const pageSize = Math.min(Math.max(Number(first) || 20, 1), 50)
  const stateQ = state === 'closed' ? 'is:closed' : 'is:open'
  const query = `is:issue ${stateQ} author:${login} sort:updated-desc`

  const data = await githubGraphQL<{
    search: {
      issueCount: number
      pageInfo: { hasNextPage: boolean, endCursor: string | null }
      nodes: (GQLCreatedNode | null)[]
    }
  }>(token, CREATED_ISSUES_QUERY, {
    query,
    first: pageSize,
    after: after || null,
  })

  const items: CreatedIssueItem[] = data.search.nodes
    .filter((n): n is GQLCreatedNode => n !== null && 'id' in n)
    .map((node) => {
      const lastComment = node.comments.nodes[0] ?? null
      const linkedPrs: CreatedIssuePR[] = node.timelineItems.nodes
        .filter(e => e.source?.number != null)
        .map((e) => {
          const commitNode = e.source!.commits?.nodes?.[0]
          const ciRaw = commitNode?.commit?.statusCheckRollup?.state
          let ciStatus: 'SUCCESS' | 'FAILURE' | 'PENDING' | null = null
          if (ciRaw === 'SUCCESS') ciStatus = 'SUCCESS'
          else if (ciRaw === 'FAILURE' || ciRaw === 'ERROR') ciStatus = 'FAILURE'
          else if (ciRaw === 'PENDING' || ciRaw === 'EXPECTED') ciStatus = 'PENDING'

          return {
            number: e.source!.number!,
            title: e.source!.title!,
            state: e.source!.state!,
            isDraft: e.source!.isDraft ?? false,
            url: e.source!.url!,
            author: e.source!.author ?? { login: 'ghost', avatarUrl: '' },
            reviewDecision: e.source!.reviewDecision ?? null,
            ciStatus,
          }
        })

      return {
        id: node.id,
        number: node.number,
        title: node.title,
        state: node.state,
        stateReason: node.stateReason,
        url: node.url,
        repo: node.repository.nameWithOwner,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        labels: node.labels.nodes,
        assignees: node.assignees.nodes,
        commentCount: node.comments.totalCount,
        reactions: {
          totalCount: node.reactions.totalCount,
          thumbsUp: node.thumbsUp.totalCount,
          thumbsDown: node.thumbsDown.totalCount,
          laugh: node.laugh.totalCount,
          hooray: node.hooray.totalCount,
          heart: node.heart.totalCount,
          rocket: node.rocket.totalCount,
          eyes: node.eyes.totalCount,
          confused: node.confused.totalCount,
        },
        linkedPrs,
        needsResponse: lastComment?.author?.login !== login && node.comments.totalCount > 0,
        lastCommentAuthor: lastComment?.author?.login ?? null,
        lastCommentAt: lastComment?.createdAt ?? null,
      }
    })

  return {
    items,
    totalCount: data.search.issueCount,
    pageInfo: data.search.pageInfo,
  }
})
