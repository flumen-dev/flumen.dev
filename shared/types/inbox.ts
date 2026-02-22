export interface InboxItem {
  type: 'issue' | 'pr'
  number: number
  title: string
  state: string
  url: string
  repo: string
  updatedAt: string
  author: { login: string, avatarUrl: string }
  labels: Array<{ name: string, color: string }>
  isDraft?: boolean
  reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  ciStatus?: 'SUCCESS' | 'FAILURE' | 'PENDING' | null
  isNew?: boolean
  isDismissed?: boolean
}
