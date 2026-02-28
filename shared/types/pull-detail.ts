export interface PullDetail {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  url: string
  body: string
  bodyHTML: string
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  author: {
    login: string
    avatarUrl: string
  }
  labels: Array<{ name: string, color: string }>
  assignees: Array<{ login: string, avatarUrl: string }>
  requestedReviewers: Array<{ login: string, avatarUrl: string }>
  linkedIssues: Array<{ number: number, title: string, state: string, url: string }>
}

export interface GraphQLPullDetailResult {
  repository: {
    pullRequest: {
      id: string
      number: number
      title: string
      state: 'OPEN' | 'CLOSED' | 'MERGED'
      isDraft: boolean
      url: string
      body: string
      bodyHTML: string
      createdAt: string
      updatedAt: string
      mergedAt: string | null
      author: { login: string, avatarUrl: string } | null
      labels: { nodes: Array<{ name: string, color: string }> }
      assignees: { nodes: Array<{ login: string, avatarUrl: string }> }
      reviewRequests: {
        nodes: Array<{ requestedReviewer: { login: string, avatarUrl: string } | null }>
      }
      closingIssuesReferences: {
        nodes: Array<{ number: number, title: string, state: string, url: string }>
      }
    } | null
  }
}
