import type { RepoIssue, RepoPullRequest } from './repository'
import type { ReactionGroup } from './issue-detail'

export type WorkItemType = 'issue' | 'pull'
export type WorkItemReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
export type WorkItemCiStatus = 'SUCCESS' | 'FAILURE' | 'PENDING' | null

export interface WorkItemRef {
  type: WorkItemType
  number: number
  title: string
  state?: string | null
  isDraft?: boolean
  htmlUrl: string
}

export interface WorkItem {
  id: string
  type: WorkItemType
  number: number
  title: string
  state: string
  htmlUrl: string
  createdAt: string
  updatedAt: string
  author: {
    login: string
    avatarUrl: string
  }
  labels: Array<{ name: string, color: string }>
  assignees: Array<{ login: string, avatarUrl: string }>
  commentCount: number
  isDraft: boolean
  reviewDecision: WorkItemReviewDecision
  ciStatus: WorkItemCiStatus
  issue: RepoIssue | null
  pull: RepoPullRequest | null
  linkedPulls: WorkItemRef[]
  linkedIssues: WorkItemRef[]
}

export interface WorkItemContribution {
  subjectId?: string
  number: number
  title: string
  state: string
  url: string
  isDraft: boolean
  reviewDecision: WorkItemReviewDecision
  ciStatus: WorkItemCiStatus
  updatedAt: string
}

export interface ReviewComment {
  id: string
  databaseId?: number
  path: string
  line: number | null
  startLine?: number | null
  diffHunk?: string
  outdated?: boolean
  body: string
  author: string
  authorAvatarUrl?: string
  createdAt: string
  reactionGroups?: ReactionGroup[]
  replies?: ReviewComment[]
}

export type WorkItemTimelineSource = 'issue' | 'pull'
export type WorkItemTimelineKind = 'comment' | 'review' | 'state' | 'assignment' | 'label' | 'event'

export interface WorkItemTimelineEntry {
  id: string
  subjectId?: string
  source: WorkItemTimelineSource
  sourceNumber: number
  kind: WorkItemTimelineKind
  isInitial?: boolean
  author: string
  authorAvatarUrl?: string
  createdAt: string
  body?: string
  reactionGroups?: ReactionGroup[]
  state?: string
  reviewState?: string
  labelName?: string
  assignee?: string
  reviewComments?: ReviewComment[]
}

export type ReviewerState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'

export interface Reviewer {
  login: string
  avatarUrl: string
  state: ReviewerState
}

export interface WorkItemDetail extends WorkItem {
  primaryType: WorkItemType
  body: string
  bodyHTML: string
  url: string
  repo: string
  contributions: WorkItemContribution[]
  timeline: WorkItemTimelineEntry[]
  reviewSummary?: {
    approved: number
    changesRequested: number
    commented: number
  }
  headBranch?: string | null
  headBranchRepo?: string | null
  reviewers?: Reviewer[]
}

export interface GraphQLWorkItemIssueNode {
  __typename?: 'Issue'
  number: number
  title: string
  state: string
  url: string
}

export interface GraphQLWorkItemPullNode {
  __typename?: 'PullRequest'
  number: number
  title: string
  state: string
  url: string
}

export interface GraphQLWorkItemIssueTimelineNode {
  __typename: 'CrossReferencedEvent'
  source: GraphQLWorkItemIssueNode | GraphQLWorkItemPullNode | null
}

export interface GraphQLWorkItemIssueResult {
  repository: {
    issue: {
      number: number
      title: string
      state: string
      url: string
      body: string
      bodyHTML: string
      createdAt: string
      updatedAt: string
      author: { login: string, avatarUrl: string } | null
      timelineItems: {
        nodes: GraphQLWorkItemIssueTimelineNode[]
      }
    } | null
  }
}

export interface GraphQLWorkItemPullResult {
  repository: {
    pullRequest: {
      number: number
      title: string
      state: string
      url: string
      body: string
      bodyHTML: string
      createdAt: string
      updatedAt: string
      author: { login: string, avatarUrl: string } | null
      closingIssuesReferences: {
        nodes: GraphQLWorkItemIssueNode[]
      }
    } | null
  }
}
