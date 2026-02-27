export type WaitingCategory = 'review-requested' | 'needs-response' | 'changes-requested'

export type CIStatus = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | null

export interface WaitingOnMeItem {
  category: WaitingCategory
  type: 'issue' | 'pr'
  number: number
  title: string
  url: string
  repo: string
  createdAt: string
  waitingSince: string
  waitingDays: number
  commentsCount: number
  isDraft: boolean | null
  additions: number | null
  deletions: number | null
  ciStatus: CIStatus
  author: { login: string, avatarUrl: string }
  requester: { login: string, avatarUrl: string }
  labels: Array<{ name: string, color: string }>
}

export interface WaitingOnMeCursors {
  review: string | null
  assigned: string | null
  changes: string | null
}

export interface WaitingOnMeResponse {
  items: WaitingOnMeItem[]
  summary: {
    totalItems: number
    uniquePeopleBlocked: number
    averageWaitDays: number
  }
  hasMore: boolean
  cursors: WaitingOnMeCursors
}
