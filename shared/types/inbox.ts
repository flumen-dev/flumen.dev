export interface UnifiedInboxItem {
  type: 'issue' | 'pr'
  number: number
  title: string
  state: string
  url: string
  repo: string
  updatedAt: string
  author: { login: string, avatarUrl: string }
  labels: Array<{ name: string, color: string }>
  commentCount: number
  isDraft?: boolean
  reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  ciStatus?: 'SUCCESS' | 'FAILURE' | 'PENDING' | null
  additions?: number
  deletions?: number
  mergeable?: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  requestedReviewers?: Array<{ login: string, avatarUrl: string }>
  assignees?: Array<{ login: string, avatarUrl: string }>
  isDismissed: boolean
}
