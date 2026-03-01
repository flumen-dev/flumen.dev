import type { ReviewComment, WorkItemTimelineEntry } from '~~/shared/types/work-item'
import type { ReactionGroup } from '~~/shared/types/issue-detail'

export interface ReviewThreadCommentNode {
  id: string
  databaseId?: number | null
  body: string
  path: string
  line: number | null
  createdAt: string
  author: { login?: string, avatarUrl?: string } | null
  reactionGroups?: Array<{ content: string, viewerHasReacted: boolean, reactors: { totalCount: number } }>
}

export interface ReviewThreadNode {
  id: string
  comments: {
    nodes: ReviewThreadCommentNode[]
  }
}

export function mapReactionGroups(groups: ReviewThreadCommentNode['reactionGroups']): ReactionGroup[] {
  if (!groups) return []
  return groups.map(g => ({
    content: g.content,
    count: g.reactors?.totalCount ?? 0,
    viewerHasReacted: g.viewerHasReacted,
  }))
}

/**
 * Build a map from root comment ID -> reply ReviewComments using reviewThreads data.
 * Each thread's first comment is the root; subsequent comments are replies.
 */
export function buildReplyMap(threads: ReviewThreadNode[]): Map<string, ReviewComment[]> {
  const replyMap = new Map<string, ReviewComment[]>()

  for (const thread of threads) {
    const comments = thread.comments.nodes
    if (comments.length < 2) continue

    const rootId = comments[0]!.id
    const replies: ReviewComment[] = comments.slice(1).map(c => ({
      id: c.id,
      databaseId: c.databaseId ?? undefined,
      path: c.path,
      line: c.line,
      body: c.body,
      author: c.author?.login ?? 'ghost',
      authorAvatarUrl: c.author?.avatarUrl,
      createdAt: c.createdAt,
      reactionGroups: mapReactionGroups(c.reactionGroups),
    }))

    replyMap.set(rootId, replies)
  }

  return replyMap
}

/**
 * Inject replies from reviewThreads into timeline review comments.
 */
export function injectReplies(timeline: WorkItemTimelineEntry[], replyMap: Map<string, ReviewComment[]>) {
  for (const entry of timeline) {
    if (entry.kind !== 'review' || !entry.reviewComments?.length) continue

    for (const rc of entry.reviewComments) {
      const replies = replyMap.get(rc.id)
      if (replies?.length) {
        rc.replies = replies
      }
    }
  }
}
