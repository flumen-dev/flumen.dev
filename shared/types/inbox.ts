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
  changedFiles?: number
  mergeable?: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  headRefName?: string
  requestedReviewers?: Array<{ login: string, avatarUrl: string }>
  assignees?: Array<{ login: string, avatarUrl: string }>
}

export interface LinkedPRRef {
  number: number
  title: string
  state: string
  url: string
}

export interface InboxPreviewPR {
  type: 'pr'
  body: string | null
  lastCommitMessage: string | null
}

export interface InboxPreviewIssue {
  type: 'issue'
  body: string | null
  milestone: string | null
  linkedPRs: Array<LinkedPRRef> | null
}

export type InboxPreview = InboxPreviewPR | InboxPreviewIssue
