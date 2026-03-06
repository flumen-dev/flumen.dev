import { describe, expect, it } from 'vitest'
import type { ReviewComment, WorkItemTimelineEntry } from '../../shared/types/work-item'
import type { ReviewThreadCommentNode, ReviewThreadNode } from '../../server/utils/review-replies'
import { buildReplyMap, injectReplies } from '../../server/utils/review-replies'

function makeThreadComment(overrides: Partial<ReviewThreadCommentNode> = {}): ReviewThreadCommentNode {
  return {
    id: 'comment-1',
    body: 'test comment',
    path: 'src/index.ts',
    line: 10,
    createdAt: '2026-01-01T00:00:00Z',
    author: { login: 'alice', avatarUrl: 'https://example.com/alice.png' },
    ...overrides,
  }
}

function makeThread(comments: ReviewThreadCommentNode[]): ReviewThreadNode {
  return {
    id: `thread-${comments[0]?.id}`,
    comments: { nodes: comments },
  }
}

function makeReviewEntry(reviewComments: ReviewComment[], overrides: Partial<WorkItemTimelineEntry> = {}): WorkItemTimelineEntry {
  return {
    id: 'entry-1',
    source: 'pull',
    sourceNumber: 1,
    kind: 'review',
    author: 'alice',
    createdAt: '2026-01-01T00:00:00Z',
    reviewComments,
    ...overrides,
  }
}

function makeReviewComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: 'rc-1',
    path: 'src/index.ts',
    line: 10,
    body: 'root comment',
    author: 'alice',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildReplyMap', () => {
  it('returns empty map for empty threads', () => {
    const result = buildReplyMap([])
    expect(result.size).toBe(0)
  })

  it('skips threads with only one comment (no replies)', () => {
    const thread = makeThread([makeThreadComment({ id: 'root-1' })])
    const result = buildReplyMap([thread])
    expect(result.size).toBe(0)
  })

  it('maps replies to root comment id', () => {
    const root = makeThreadComment({ id: 'root-1', body: 'root' })
    const reply = makeThreadComment({ id: 'reply-1', body: 'reply', author: { login: 'bob', avatarUrl: 'https://example.com/bob.png' } })
    const thread = makeThread([root, reply])

    const result = buildReplyMap([thread])

    expect(result.size).toBe(1)
    const replies = result.get('root-1')!
    expect(replies).toHaveLength(1)
    expect(replies[0]!.id).toBe('reply-1')
    expect(replies[0]!.body).toBe('reply')
    expect(replies[0]!.author).toBe('bob')
  })

  it('handles multiple replies in a single thread', () => {
    const root = makeThreadComment({ id: 'root-1' })
    const reply1 = makeThreadComment({ id: 'reply-1', body: 'first reply' })
    const reply2 = makeThreadComment({ id: 'reply-2', body: 'second reply' })
    const thread = makeThread([root, reply1, reply2])

    const result = buildReplyMap([thread])
    const replies = result.get('root-1')!
    expect(replies).toHaveLength(2)
    expect(replies[0]!.id).toBe('reply-1')
    expect(replies[1]!.id).toBe('reply-2')
  })

  it('handles multiple threads', () => {
    const thread1 = makeThread([
      makeThreadComment({ id: 'root-1' }),
      makeThreadComment({ id: 'reply-1a' }),
    ])
    const thread2 = makeThread([
      makeThreadComment({ id: 'root-2' }),
      makeThreadComment({ id: 'reply-2a' }),
      makeThreadComment({ id: 'reply-2b' }),
    ])

    const result = buildReplyMap([thread1, thread2])
    expect(result.size).toBe(2)
    expect(result.get('root-1')).toHaveLength(1)
    expect(result.get('root-2')).toHaveLength(2)
  })

  it('uses ghost as author when author is null', () => {
    const root = makeThreadComment({ id: 'root-1' })
    const reply = makeThreadComment({ id: 'reply-1', author: null })
    const thread = makeThread([root, reply])

    const result = buildReplyMap([thread])
    expect(result.get('root-1')![0]!.author).toBe('ghost')
  })

  it('maps viewerCanUpdate and viewerCanDelete permissions', () => {
    const root = makeThreadComment({ id: 'root-1' })
    const reply = makeThreadComment({ id: 'reply-1', viewerCanUpdate: true, viewerCanDelete: false })
    const thread = makeThread([root, reply])

    const result = buildReplyMap([thread])
    const replyResult = result.get('root-1')![0]!
    expect(replyResult.viewerCanUpdate).toBe(true)
    expect(replyResult.viewerCanDelete).toBe(false)
  })

  it('leaves permissions undefined when not provided', () => {
    const root = makeThreadComment({ id: 'root-1' })
    const reply = makeThreadComment({ id: 'reply-1' })
    const thread = makeThread([root, reply])

    const result = buildReplyMap([thread])
    const replyResult = result.get('root-1')![0]!
    expect(replyResult.viewerCanUpdate).toBeUndefined()
    expect(replyResult.viewerCanDelete).toBeUndefined()
  })

  it('maps databaseId from thread comments', () => {
    const root = makeThreadComment({ id: 'root-1' })
    const reply = makeThreadComment({ id: 'reply-1', databaseId: 12345 })
    const thread = makeThread([root, reply])

    const result = buildReplyMap([thread])
    expect(result.get('root-1')![0]!.databaseId).toBe(12345)
  })

  it('converts null databaseId to undefined', () => {
    const root = makeThreadComment({ id: 'root-1' })
    const reply = makeThreadComment({ id: 'reply-1', databaseId: null })
    const thread = makeThread([root, reply])

    const result = buildReplyMap([thread])
    expect(result.get('root-1')![0]!.databaseId).toBeUndefined()
  })

  it('maps reaction groups correctly', () => {
    const root = makeThreadComment({ id: 'root-1' })
    const reply = makeThreadComment({
      id: 'reply-1',
      reactionGroups: [
        { content: 'THUMBS_UP', viewerHasReacted: true, reactors: { totalCount: 3 } },
        { content: 'HEART', viewerHasReacted: false, reactors: { totalCount: 1 } },
      ],
    })
    const thread = makeThread([root, reply])

    const result = buildReplyMap([thread])
    const replyResult = result.get('root-1')![0]!
    expect(replyResult.reactionGroups).toHaveLength(2)
    expect(replyResult.reactionGroups![0]).toEqual({ content: 'THUMBS_UP', count: 3, viewerHasReacted: true })
    expect(replyResult.reactionGroups![1]).toEqual({ content: 'HEART', count: 1, viewerHasReacted: false })
  })

  it('returns empty reaction groups when none provided', () => {
    const root = makeThreadComment({ id: 'root-1' })
    const reply = makeThreadComment({ id: 'reply-1', reactionGroups: undefined })
    const thread = makeThread([root, reply])

    const result = buildReplyMap([thread])
    expect(result.get('root-1')![0]!.reactionGroups).toEqual([])
  })
})

describe('injectReplies', () => {
  it('does nothing for empty timeline', () => {
    const timeline: WorkItemTimelineEntry[] = []
    const replyMap = new Map<string, ReviewComment[]>()
    injectReplies(timeline, replyMap)
    expect(timeline).toEqual([])
  })

  it('skips non-review entries', () => {
    const timeline: WorkItemTimelineEntry[] = [
      {
        id: 'e1',
        source: 'issue',
        sourceNumber: 1,
        kind: 'comment',
        author: 'alice',
        createdAt: '2026-01-01T00:00:00Z',
        body: 'hello',
      },
    ]
    const replyMap = new Map([['rc-1', [makeReviewComment({ id: 'reply-1' })]]])
    injectReplies(timeline, replyMap)
    expect('replies' in timeline[0]!).toBe(false)
  })

  it('skips review entries with no reviewComments', () => {
    const timeline = [makeReviewEntry([])]
    const replyMap = new Map([['rc-1', [makeReviewComment({ id: 'reply-1' })]]])
    injectReplies(timeline, replyMap)
    expect(timeline[0]!.reviewComments).toEqual([])
  })

  it('skips review entries with undefined reviewComments', () => {
    const entry: WorkItemTimelineEntry = {
      id: 'entry-1',
      source: 'pull',
      sourceNumber: 1,
      kind: 'review',
      author: 'alice',
      createdAt: '2026-01-01T00:00:00Z',
    }
    const timeline = [entry]
    const replyMap = new Map([['rc-1', [makeReviewComment({ id: 'reply-1' })]]])
    injectReplies(timeline, replyMap)
    expect(entry.reviewComments).toBeUndefined()
  })

  it('injects replies into matching review comments', () => {
    const rc = makeReviewComment({ id: 'rc-1' })
    const timeline = [makeReviewEntry([rc])]
    const replies = [makeReviewComment({ id: 'reply-1', body: 'a reply' })]
    const replyMap = new Map([['rc-1', replies]])

    injectReplies(timeline, replyMap)

    expect(timeline[0]!.reviewComments![0]!.replies).toHaveLength(1)
    expect(timeline[0]!.reviewComments![0]!.replies![0]!.body).toBe('a reply')
  })

  it('does not inject replies for unmatched comment ids', () => {
    const rc = makeReviewComment({ id: 'rc-1' })
    const timeline = [makeReviewEntry([rc])]
    const replyMap = new Map([['rc-other', [makeReviewComment({ id: 'reply-1' })]]])

    injectReplies(timeline, replyMap)

    expect(timeline[0]!.reviewComments![0]!.replies).toBeUndefined()
  })

  it('injects replies across multiple review entries', () => {
    const rc1 = makeReviewComment({ id: 'rc-1' })
    const rc2 = makeReviewComment({ id: 'rc-2' })
    const entry1 = makeReviewEntry([rc1], { id: 'entry-1' })
    const entry2 = makeReviewEntry([rc2], { id: 'entry-2' })
    const timeline = [entry1, entry2]

    const replyMap = new Map([
      ['rc-1', [makeReviewComment({ id: 'reply-1a' })]],
      ['rc-2', [makeReviewComment({ id: 'reply-2a' }), makeReviewComment({ id: 'reply-2b' })]],
    ])

    injectReplies(timeline, replyMap)

    expect(entry1.reviewComments![0]!.replies).toHaveLength(1)
    expect(entry2.reviewComments![0]!.replies).toHaveLength(2)
  })
})
