import { describe, expect, it } from 'vitest'
import type { Issue } from '../../shared/types/issue'
import { categorizeIssue, createEmptyIssueBuckets, ISSUE_SECTION_KEYS } from '../../app/utils/issueSections'

const NOW = Date.now()
const days = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

const baseIssue: Issue = {
  id: 'I_1',
  number: 42,
  title: 'Test',
  state: 'OPEN',
  stateReason: null,
  url: 'https://github.com/org/repo/issues/42',
  createdAt: days(2),
  updatedAt: days(2),
  closedAt: null,
  author: { login: 'alice', avatarUrl: '' },
  labels: [],
  assignees: [],
  milestone: null,
  commentCount: 0,
  linkedPrCount: 0,
  maintainerCommented: false,
  repository: { nameWithOwner: 'org/repo', name: 'repo', owner: 'org' },
}

describe('categorizeIssue', () => {
  it('puts closed issues into other-open as the catch-all', () => {
    expect(categorizeIssue({ ...baseIssue, state: 'CLOSED' }, 'me')).toBe('other-open')
  })

  it('returns needs-response when comments exist and maintainer has not commented', () => {
    const i = { ...baseIssue, commentCount: 3, maintainerCommented: false }
    expect(categorizeIssue(i, 'me')).toBe('needs-response')
  })

  it('does not flag needs-response when maintainer already commented', () => {
    const i = { ...baseIssue, commentCount: 3, maintainerCommented: true }
    expect(categorizeIssue(i, 'me')).not.toBe('needs-response')
  })

  it('does not flag needs-response when there are no comments', () => {
    const i = { ...baseIssue, commentCount: 0, maintainerCommented: false }
    expect(categorizeIssue(i, 'me')).not.toBe('needs-response')
  })

  it('skips needs-response when user is not signed in', () => {
    const i = { ...baseIssue, commentCount: 3, maintainerCommented: false }
    expect(categorizeIssue(i, null)).not.toBe('needs-response')
  })

  it('returns fresh-unassigned for new issues without assignee or PR', () => {
    const i = { ...baseIssue, createdAt: days(2), assignees: [], linkedPrCount: 0 }
    expect(categorizeIssue(i, 'me')).toBe('fresh-unassigned')
  })

  it('does not flag fresh-unassigned when older than 7 days', () => {
    const i = { ...baseIssue, createdAt: days(10), assignees: [], linkedPrCount: 0 }
    expect(categorizeIssue(i, 'me')).not.toBe('fresh-unassigned')
  })

  it('does not flag fresh-unassigned when an assignee exists', () => {
    const i = { ...baseIssue, createdAt: days(2), assignees: [{ login: 'bob', avatarUrl: '' }], linkedPrCount: 0 }
    expect(categorizeIssue(i, 'me')).not.toBe('fresh-unassigned')
  })

  it('returns in-progress when assignees and a linked PR coexist', () => {
    const i = { ...baseIssue, assignees: [{ login: 'bob', avatarUrl: '' }], linkedPrCount: 1 }
    expect(categorizeIssue(i, 'me')).toBe('in-progress')
  })

  it('returns stale for issues with no activity for over 30 days', () => {
    const i = { ...baseIssue, createdAt: days(60), updatedAt: days(45) }
    expect(categorizeIssue(i, 'me')).toBe('stale')
  })

  it('falls back to other-open when nothing else matches', () => {
    const i = { ...baseIssue, createdAt: days(20), updatedAt: days(15) }
    expect(categorizeIssue(i, 'me')).toBe('other-open')
  })

  it('priority: needs-response wins over fresh-unassigned', () => {
    const i = { ...baseIssue, createdAt: days(2), commentCount: 1, maintainerCommented: false, assignees: [], linkedPrCount: 0 }
    expect(categorizeIssue(i, 'me')).toBe('needs-response')
  })

  it('priority: in-progress wins over stale', () => {
    const i = { ...baseIssue, updatedAt: days(60), assignees: [{ login: 'bob', avatarUrl: '' }], linkedPrCount: 1 }
    expect(categorizeIssue(i, 'me')).toBe('in-progress')
  })
})

describe('createEmptyIssueBuckets', () => {
  it('contains an empty array for every section key', () => {
    const buckets = createEmptyIssueBuckets()
    for (const key of ISSUE_SECTION_KEYS) {
      expect(buckets[key]).toEqual([])
    }
  })
})
