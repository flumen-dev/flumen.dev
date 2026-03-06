import { describe, expect, it } from 'vitest'
import type { ReviewComment, WorkItemTimelineEntry } from '../../shared/types/work-item'
import { editCommentBody, editReviewComment, removeComment, removeReviewComment } from '../../shared/utils/timeline-mappers'

function makeEntry(overrides: Partial<WorkItemTimelineEntry> = {}): WorkItemTimelineEntry {
  return {
    id: 'entry-1',
    source: 'issue',
    sourceNumber: 1,
    kind: 'comment',
    author: 'alice',
    createdAt: '2026-01-01T00:00:00Z',
    body: 'original body',
    ...overrides,
  }
}

function makeReviewComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: 'rc-1',
    databaseId: 100,
    path: 'src/index.ts',
    line: 10,
    body: 'review comment body',
    author: 'alice',
    createdAt: '2026-01-01T00:00:00Z',
    viewerCanUpdate: true,
    viewerCanDelete: true,
    ...overrides,
  }
}

describe('editCommentBody', () => {
  it('updates the body of the matching entry', () => {
    const timeline = [makeEntry({ id: 'e1', body: 'old' }), makeEntry({ id: 'e2', body: 'other' })]
    const result = editCommentBody(timeline, 'e1', 'new body')

    expect(result[0]!.body).toBe('new body')
    expect(result[1]!.body).toBe('other')
  })

  it('returns new array (immutable)', () => {
    const timeline = [makeEntry({ id: 'e1' })]
    const result = editCommentBody(timeline, 'e1', 'updated')

    expect(result).not.toBe(timeline)
    expect(result[0]).not.toBe(timeline[0])
  })

  it('does not modify entries that do not match', () => {
    const timeline = [makeEntry({ id: 'e1', body: 'keep' })]
    const result = editCommentBody(timeline, 'nonexistent', 'updated')

    expect(result[0]!.body).toBe('keep')
    expect(result[0]).toBe(timeline[0]) // same reference — untouched
  })
})

describe('removeComment', () => {
  it('removes the matching entry', () => {
    const timeline = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })]
    const result = removeComment(timeline, 'e1')

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('e2')
  })

  it('returns empty array when last entry is deleted', () => {
    const timeline = [makeEntry({ id: 'e1' })]
    const result = removeComment(timeline, 'e1')

    expect(result).toHaveLength(0)
  })

  it('does nothing when id does not match', () => {
    const timeline = [makeEntry({ id: 'e1' })]
    const result = removeComment(timeline, 'nonexistent')

    expect(result).toHaveLength(1)
  })
})

describe('editReviewComment', () => {
  it('updates a root review comment body', () => {
    const rc = makeReviewComment({ id: 'rc-1', body: 'old' })
    const entry = makeEntry({ id: 'e1', kind: 'review', source: 'pull', reviewComments: [rc] })
    const result = editReviewComment([entry], 'e1', 'rc-1', 'new review body')

    expect(result[0]!.reviewComments![0]!.body).toBe('new review body')
  })

  it('updates a reply body within a review comment', () => {
    const reply = makeReviewComment({ id: 'reply-1', body: 'old reply' })
    const rc = makeReviewComment({ id: 'rc-1', replies: [reply] })
    const entry = makeEntry({ id: 'e1', kind: 'review', source: 'pull', reviewComments: [rc] })

    const result = editReviewComment([entry], 'e1', 'reply-1', 'updated reply')

    expect(result[0]!.reviewComments![0]!.replies![0]!.body).toBe('updated reply')
    expect(result[0]!.reviewComments![0]!.body).toBe('review comment body') // root unchanged
  })

  it('does not touch other entries', () => {
    const rc = makeReviewComment({ id: 'rc-1' })
    const entry1 = makeEntry({ id: 'e1', kind: 'review', source: 'pull', reviewComments: [rc] })
    const entry2 = makeEntry({ id: 'e2', body: 'untouched' })

    const result = editReviewComment([entry1, entry2], 'e1', 'rc-1', 'changed')

    expect(result[1]).toBe(entry2) // same reference
  })

  it('is immutable — does not modify original', () => {
    const rc = makeReviewComment({ id: 'rc-1', body: 'original' })
    const entry = makeEntry({ id: 'e1', kind: 'review', source: 'pull', reviewComments: [rc] })
    const timeline = [entry]

    editReviewComment(timeline, 'e1', 'rc-1', 'modified')

    expect(entry.reviewComments![0]!.body).toBe('original')
  })
})

describe('removeReviewComment', () => {
  it('removes a root review comment', () => {
    const rc1 = makeReviewComment({ id: 'rc-1' })
    const rc2 = makeReviewComment({ id: 'rc-2' })
    const entry = makeEntry({ id: 'e1', kind: 'review', source: 'pull', reviewComments: [rc1, rc2] })

    const result = removeReviewComment([entry], 'e1', 'rc-1')

    expect(result[0]!.reviewComments).toHaveLength(1)
    expect(result[0]!.reviewComments![0]!.id).toBe('rc-2')
  })

  it('removes a reply from a review comment', () => {
    const reply1 = makeReviewComment({ id: 'reply-1' })
    const reply2 = makeReviewComment({ id: 'reply-2' })
    const rc = makeReviewComment({ id: 'rc-1', replies: [reply1, reply2] })
    const entry = makeEntry({ id: 'e1', kind: 'review', source: 'pull', reviewComments: [rc] })

    const result = removeReviewComment([entry], 'e1', 'reply-1')

    expect(result[0]!.reviewComments![0]!.replies).toHaveLength(1)
    expect(result[0]!.reviewComments![0]!.replies![0]!.id).toBe('reply-2')
  })

  it('results in empty reviewComments when last one is deleted', () => {
    const rc = makeReviewComment({ id: 'rc-1' })
    const entry = makeEntry({ id: 'e1', kind: 'review', source: 'pull', reviewComments: [rc] })

    const result = removeReviewComment([entry], 'e1', 'rc-1')

    expect(result[0]!.reviewComments).toHaveLength(0)
  })

  it('is immutable — does not modify original', () => {
    const rc = makeReviewComment({ id: 'rc-1' })
    const entry = makeEntry({ id: 'e1', kind: 'review', source: 'pull', reviewComments: [rc] })
    const timeline = [entry]

    removeReviewComment(timeline, 'e1', 'rc-1')

    expect(entry.reviewComments).toHaveLength(1) // original unchanged
  })

  it('does nothing when id does not match any comment or reply', () => {
    const rc = makeReviewComment({ id: 'rc-1', replies: [makeReviewComment({ id: 'reply-1' })] })
    const entry = makeEntry({ id: 'e1', kind: 'review', source: 'pull', reviewComments: [rc] })

    const result = removeReviewComment([entry], 'e1', 'nonexistent')

    expect(result[0]!.reviewComments).toHaveLength(1)
    expect(result[0]!.reviewComments![0]!.replies).toHaveLength(1)
  })
})
