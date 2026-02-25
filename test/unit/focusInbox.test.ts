import { describe, expect, it } from 'vitest'
import { mapPRNode, mapIssueNode } from '../../server/utils/focus-inbox'
import type { GQLInboxPR, GQLInboxIssue } from '../../server/utils/focus-inbox'

// --- Helpers ---

function makePR(overrides: Partial<GQLInboxPR> = {}): GQLInboxPR {
  return {
    __typename: 'PullRequest',
    number: 42,
    title: 'Fix auth flow',
    state: 'OPEN',
    url: 'https://github.com/org/repo/pull/42',
    updatedAt: '2025-01-10T00:00:00Z',
    isDraft: false,
    author: { login: 'dev', avatarUrl: 'https://avatar/dev' },
    labels: { nodes: [{ name: 'bug', color: 'ff0000' }] },
    repository: { nameWithOwner: 'org/repo' },
    reviewDecision: 'APPROVED',
    additions: 50,
    deletions: 10,
    changedFiles: 5,
    mergeable: 'MERGEABLE',
    headRefName: 'fix/auth-flow',
    comments: { totalCount: 3 },
    reviewRequests: { nodes: [{ requestedReviewer: { login: 'reviewer1', avatarUrl: 'https://avatar/reviewer1' } }] },
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
    ...overrides,
  }
}

function makeIssue(overrides: Partial<GQLInboxIssue> = {}): GQLInboxIssue {
  return {
    __typename: 'Issue',
    number: 10,
    title: 'Bug report',
    state: 'OPEN',
    url: 'https://github.com/org/repo/issues/10',
    updatedAt: '2025-01-10T00:00:00Z',
    author: { login: 'user', avatarUrl: 'https://avatar/user' },
    labels: { nodes: [] },
    repository: { nameWithOwner: 'org/repo' },
    comments: { totalCount: 2 },
    assignees: { nodes: [{ login: 'assignee1', avatarUrl: 'https://avatar/assignee1' }] },
    ...overrides,
  }
}

// --- mapPRNode ---

describe('mapPRNode', () => {
  it('maps all PR fields correctly', () => {
    const result = mapPRNode(makePR())
    expect(result).toEqual({
      type: 'pr',
      number: 42,
      title: 'Fix auth flow',
      state: 'OPEN',
      url: 'https://github.com/org/repo/pull/42',
      repo: 'org/repo',
      updatedAt: '2025-01-10T00:00:00Z',
      author: { login: 'dev', avatarUrl: 'https://avatar/dev' },
      labels: [{ name: 'bug', color: 'ff0000' }],
      commentCount: 3,
      isDraft: false,
      reviewDecision: 'APPROVED',
      ciStatus: 'SUCCESS',
      additions: 50,
      deletions: 10,
      changedFiles: 5,
      mergeable: 'MERGEABLE',
      headRefName: 'fix/auth-flow',
      requestedReviewers: [{ login: 'reviewer1', avatarUrl: 'https://avatar/reviewer1' }],
    })
  })

  it('uses ghost author when author is null', () => {
    const result = mapPRNode(makePR({ author: null }))
    expect(result.author).toEqual({ login: 'ghost', avatarUrl: '' })
  })

  it('maps CI status from commit rollup', () => {
    const pending = mapPRNode(makePR({
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'PENDING' } } }] },
    }))
    expect(pending.ciStatus).toBe('PENDING')

    const failure = mapPRNode(makePR({
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'ERROR' } } }] },
    }))
    expect(failure.ciStatus).toBe('FAILURE')
  })

  it('returns null ciStatus when no commits', () => {
    const result = mapPRNode(makePR({ commits: undefined }))
    expect(result.ciStatus).toBeNull()
  })

  it('maps draft status', () => {
    const result = mapPRNode(makePR({ isDraft: true }))
    expect(result.isDraft).toBe(true)
  })

  it('filters null requested reviewers', () => {
    const result = mapPRNode(makePR({
      reviewRequests: { nodes: [
        { requestedReviewer: { login: 'a', avatarUrl: 'https://avatar/a' } },
        { requestedReviewer: null },
      ] },
    }))
    expect(result.requestedReviewers).toEqual([{ login: 'a', avatarUrl: 'https://avatar/a' }])
  })

  it('maps merge conflict status', () => {
    const result = mapPRNode(makePR({ mergeable: 'CONFLICTING' }))
    expect(result.mergeable).toBe('CONFLICTING')
  })
})

// --- mapIssueNode ---

describe('mapIssueNode', () => {
  it('maps all issue fields correctly', () => {
    const result = mapIssueNode(makeIssue())
    expect(result).toEqual({
      type: 'issue',
      number: 10,
      title: 'Bug report',
      state: 'OPEN',
      url: 'https://github.com/org/repo/issues/10',
      repo: 'org/repo',
      updatedAt: '2025-01-10T00:00:00Z',
      author: { login: 'user', avatarUrl: 'https://avatar/user' },
      labels: [],
      commentCount: 2,
      assignees: [{ login: 'assignee1', avatarUrl: 'https://avatar/assignee1' }],
    })
  })

  it('uses ghost author when author is null', () => {
    const result = mapIssueNode(makeIssue({ author: null }))
    expect(result.author).toEqual({ login: 'ghost', avatarUrl: '' })
  })
})
