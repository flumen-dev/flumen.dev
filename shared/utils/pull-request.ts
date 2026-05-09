import type { Mergeable, PullRequest, PullRequestState, ReviewDecision } from '../types/pull-request'
import type { CIStatus } from '../types/waiting-on-me'

export interface GraphQLPullRequestNode {
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
  additions: number
  deletions: number
  changedFiles: number
  headRefName: string
  baseRefName: string
  mergeable: Mergeable
  reviewDecision: ReviewDecision
  author: { login: string, avatarUrl: string } | null
  labels: { nodes: Array<{ name: string, color: string }> }
  assignees: { nodes: Array<{ login: string, avatarUrl: string }> }
  reviewRequests: {
    nodes: Array<{ requestedReviewer: { login: string, avatarUrl: string } | null }>
  }
  comments: { totalCount: number }
  closingIssuesReferences: { totalCount: number }
  commits: {
    nodes: Array<{
      commit: { statusCheckRollup: { state: string } | null }
    }>
  }
  repository: {
    nameWithOwner: string
    name: string
    owner: { login: string }
  }
}

function extractCIStatus(node: GraphQLPullRequestNode): CIStatus {
  const state = node.commits.nodes[0]?.commit.statusCheckRollup?.state
  if (!state) return null
  if (state === 'SUCCESS' || state === 'FAILURE' || state === 'ERROR'
    || state === 'PENDING' || state === 'EXPECTED') {
    return state
  }
  return null
}

export function toPullRequest(node: GraphQLPullRequestNode): PullRequest {
  return {
    id: node.id,
    number: node.number,
    title: node.title,
    state: node.state,
    isDraft: node.isDraft,
    url: node.url,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    closedAt: node.closedAt,
    mergedAt: node.mergedAt,
    author: node.author ?? { login: 'ghost', avatarUrl: '' },
    labels: node.labels.nodes,
    assignees: node.assignees.nodes,
    requestedReviewers: node.reviewRequests.nodes
      .map(n => n.requestedReviewer)
      .filter((r): r is { login: string, avatarUrl: string } => r !== null),
    reviewDecision: node.reviewDecision,
    ciStatus: extractCIStatus(node),
    mergeable: node.mergeable,
    additions: node.additions,
    deletions: node.deletions,
    changedFiles: node.changedFiles,
    commentCount: node.comments.totalCount,
    linkedIssueCount: node.closingIssuesReferences.totalCount,
    headRefName: node.headRefName,
    baseRefName: node.baseRefName,
    repository: node.repository,
  }
}
