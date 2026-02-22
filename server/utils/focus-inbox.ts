import type { InboxItem } from '~~/shared/types/inbox'
import { mapCiStatus } from './focus-created'

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
}

const GHOST_AUTHOR = { login: 'ghost', avatarUrl: '' }

export function mapPRNode(node: GQLInboxPR): InboxItem {
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
    isDraft: node.isDraft,
    reviewDecision: node.reviewDecision,
    ciStatus: mapCiStatus(node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state),
  }
}

export function mapIssueNode(node: GQLInboxIssue): InboxItem {
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
  }
}

export function mapMixedNode(node: GQLInboxIssue | GQLInboxPR): InboxItem {
  if ('isDraft' in node || node.__typename === 'PullRequest') {
    return mapPRNode(node as GQLInboxPR)
  }
  return mapIssueNode(node)
}
