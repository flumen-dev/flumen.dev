export interface Issue {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  createdAt: string
  updatedAt: string
  closedAt: string | null

  author: {
    login: string
    avatarUrl: string
  }

  labels: Array<{
    name: string
    color: string
  }>

  assignees: Array<{
    login: string
    avatarUrl: string
  }>

  milestone: string | null
  commentCount: number
  linkedPrCount: number
  maintainerCommented: boolean

  repository: {
    nameWithOwner: string
    name: string
    owner: string
  }
}

/** Shape returned by GitHub GraphQL search for issues */
export interface GraphQLIssueNode {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  author: { login: string, avatarUrl: string } | null
  labels: { nodes: Array<{ name: string, color: string }> }
  assignees: { nodes: Array<{ login: string, avatarUrl: string }> }
  milestone: { title: string } | null
  comments: { totalCount: number, nodes: Array<{ author: { login: string } | null }> }
  timelineItems: { totalCount: number }
  repository: { nameWithOwner: string, name: string, owner: { login: string } }
}

export interface GraphQLIssueSearchResult {
  search: {
    issueCount: number
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | null
    }
    nodes: GraphQLIssueNode[]
  }
}
