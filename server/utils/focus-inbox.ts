import type { UnifiedInboxItem } from '~~/shared/types/inbox'
import { mapCiStatus } from './focus-created'

type BaseInboxItem = UnifiedInboxItem

export interface GQLInboxPR {
  __typename?: string
  number: number
  title: string
  state: string
  url: string
  updatedAt: string
  isDraft: boolean
  author: { login: string, avatarUrl: string } | null
  labels: { nodes: Array<{ name: string, color: string }> }
  repository: { nameWithOwner: string }
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  additions: number
  deletions: number
  changedFiles: number
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  headRefName: string
  comments: { totalCount: number }
  reviewRequests: { nodes: Array<{ requestedReviewer: { login: string, avatarUrl: string } | null }> }
  commits?: {
    nodes: Array<{
      commit: {
        statusCheckRollup: { state: string } | null
      }
    }>
  }
}

export interface GQLInboxIssue {
  __typename?: string
  number: number
  title: string
  state: string
  url: string
  updatedAt: string
  author: { login: string, avatarUrl: string } | null
  labels: { nodes: Array<{ name: string, color: string }> }
  repository: { nameWithOwner: string }
  comments: { totalCount: number }
  assignees: { nodes: Array<{ login: string, avatarUrl: string }> }
}

const GHOST_AUTHOR = { login: 'ghost', avatarUrl: '' }

export function mapPRNode(node: GQLInboxPR): BaseInboxItem {
  return {
    type: 'pr',
    number: node.number,
    title: node.title,
    state: node.state,
    url: node.url,
    repo: node.repository.nameWithOwner,
    updatedAt: node.updatedAt,
    author: node.author ?? GHOST_AUTHOR,
    labels: node.labels.nodes,
    commentCount: node.comments?.totalCount ?? 0,
    isDraft: node.isDraft,
    reviewDecision: node.reviewDecision,
    ciStatus: mapCiStatus(node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state),
    additions: node.additions,
    deletions: node.deletions,
    changedFiles: node.changedFiles,
    mergeable: node.mergeable,
    headRefName: node.headRefName,
    requestedReviewers: (node.reviewRequests?.nodes ?? [])
      .map(n => n.requestedReviewer)
      .filter((r): r is { login: string, avatarUrl: string } => r !== null),
  }
}

export function mapIssueNode(node: GQLInboxIssue): BaseInboxItem {
  return {
    type: 'issue',
    number: node.number,
    title: node.title,
    state: node.state,
    url: node.url,
    repo: node.repository.nameWithOwner,
    updatedAt: node.updatedAt,
    author: node.author ?? GHOST_AUTHOR,
    labels: node.labels.nodes,
    commentCount: node.comments?.totalCount ?? 0,
    assignees: node.assignees?.nodes ?? [],
  }
}
