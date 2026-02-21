import type { CreatedIssueItem, CreatedIssuePR } from '../api/focus/created.get'

export interface GQLCreatedNode {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  createdAt: string
  updatedAt: string
  labels: { nodes: Array<{ name: string, color: string }> }
  assignees: { nodes: Array<{ login: string, avatarUrl: string }> }
  comments: {
    totalCount: number
    nodes: Array<{ author: { login: string } | null, createdAt: string }>
  }
  reactions: { totalCount: number }
  thumbsUp: { totalCount: number }
  thumbsDown: { totalCount: number }
  laugh: { totalCount: number }
  hooray: { totalCount: number }
  heart: { totalCount: number }
  rocket: { totalCount: number }
  eyes: { totalCount: number }
  confused: { totalCount: number }
  timelineItems: {
    nodes: Array<{
      source: {
        number?: number
        title?: string
        state?: 'OPEN' | 'CLOSED' | 'MERGED'
        isDraft?: boolean
        url?: string
        author?: { login: string, avatarUrl: string }
        reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
        commits?: {
          nodes: Array<{
            commit: {
              statusCheckRollup: { state: string } | null
            }
          }>
        }
      } | null
    }>
  }
  repository: { nameWithOwner: string }
}

export function mapCiStatus(raw: string | undefined | null): 'SUCCESS' | 'FAILURE' | 'PENDING' | null {
  if (raw === 'SUCCESS') return 'SUCCESS'
  if (raw === 'FAILURE' || raw === 'ERROR') return 'FAILURE'
  if (raw === 'PENDING' || raw === 'EXPECTED') return 'PENDING'
  return null
}

export function mapCreatedNode(node: GQLCreatedNode, login: string): CreatedIssueItem {
  const lastComment = node.comments.nodes[0] ?? null
  const linkedPrs: CreatedIssuePR[] = node.timelineItems.nodes
    .filter(e => e.source?.number != null)
    .map((e) => {
      const commitNode = e.source!.commits?.nodes?.[0]
      const ciRaw = commitNode?.commit?.statusCheckRollup?.state
      return {
        number: e.source!.number!,
        title: e.source!.title!,
        state: e.source!.state!,
        isDraft: e.source!.isDraft ?? false,
        url: e.source!.url!,
        author: e.source!.author ?? { login: 'ghost', avatarUrl: '' },
        reviewDecision: e.source!.reviewDecision ?? null,
        ciStatus: mapCiStatus(ciRaw),
      }
    })

  return {
    id: node.id,
    number: node.number,
    title: node.title,
    state: node.state,
    stateReason: node.stateReason,
    url: node.url,
    repo: node.repository.nameWithOwner,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    labels: node.labels.nodes,
    assignees: node.assignees.nodes,
    commentCount: node.comments.totalCount,
    reactions: {
      totalCount: node.reactions.totalCount,
      thumbsUp: node.thumbsUp.totalCount,
      thumbsDown: node.thumbsDown.totalCount,
      laugh: node.laugh.totalCount,
      hooray: node.hooray.totalCount,
      heart: node.heart.totalCount,
      rocket: node.rocket.totalCount,
      eyes: node.eyes.totalCount,
      confused: node.confused.totalCount,
    },
    linkedPrs,
    needsResponse: lastComment?.author?.login !== login && node.comments.totalCount > 0,
    lastCommentAuthor: lastComment?.author?.login ?? null,
    lastCommentAt: lastComment?.createdAt ?? null,
  }
}
