export type PRHealthCategory
  = 'ci-failing'
    | 'merge-conflict'
    | 'needs-reviewers'
    | 'stale-draft'
    | 'approved-not-merged'

export interface PRHealthItem {
  category: PRHealthCategory
  number: number
  title: string
  url: string
  repo: string
  createdAt: string
  updatedAt: string
  ageDays: number
  isDraft: boolean
  additions: number
  deletions: number
  ciStatus: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | null
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  author: { login: string, avatarUrl: string }
  labels: Array<{ name: string, color: string }>
  headRefName: string
  requestedReviewers: Array<{ login: string, avatarUrl: string }>
}

export interface PRHealthResponse {
  items: PRHealthItem[]
  summary: {
    totalIssues: number
    ciFailures: number
    conflicts: number
  }
}
