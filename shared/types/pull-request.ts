import type { PageInfo } from './pagination'
import type { CIStatus } from './waiting-on-me'

export type PullRequestState = 'OPEN' | 'CLOSED' | 'MERGED'
export type Mergeable = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED'

/**
 * List-row representation of a pull request. Keep this lighter than the
 * detail type — anything required for cards/rows/categorization only.
 */
export interface PullRequest {
  id: string
  number: number
  title: string
  state: PullRequestState
  isDraft: boolean
  url: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  mergedAt: string | null

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

  requestedReviewers: Array<{
    login: string
    avatarUrl: string
  }>

  reviewDecision: ReviewDecision
  ciStatus: CIStatus
  mergeable: Mergeable

  /** Most recent review per reviewer — used to render the approval counter. */
  latestReviews: Array<{
    state: ReviewState
    author: { login: string, avatarUrl: string }
  }>

  additions: number
  deletions: number
  changedFiles: number
  commentCount: number
  linkedIssueCount: number

  headRefName: string
  baseRefName: string

  repository: {
    nameWithOwner: string
    name: string
    owner: { login: string }
  }
}

export interface MinimalPullRequestNode {
  id: string
  number: number
  updatedAt: string
  repository: {
    nameWithOwner: string
    name: string
    owner: { login: string }
  }
}

export interface PullRequestListResponse {
  items: PullRequest[]
  totalCount: number
  pageInfo: PageInfo
}
