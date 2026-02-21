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
    .map(node => mapCreatedNode(node, login))

  return {
    items,
    totalCount: data.search.issueCount,
    pageInfo: data.search.pageInfo,
  }
})
