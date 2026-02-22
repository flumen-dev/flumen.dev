import { describe, expect, it } from 'vitest'
import { mapPRNode, mapIssueNode, mapMixedNode } from '../../server/utils/focus-inbox'
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
      isDraft: false,
      reviewDecision: 'APPROVED',
      ciStatus: 'SUCCESS',
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
    })
  })

  it('uses ghost author when author is null', () => {
    const result = mapIssueNode(makeIssue({ author: null }))
    expect(result.author).toEqual({ login: 'ghost', avatarUrl: '' })
  })
})

// --- mapMixedNode ---

describe('mapMixedNode', () => {
  it('dispatches to mapPRNode when __typename is PullRequest', () => {
    const result = mapMixedNode(makePR())
    expect(result.type).toBe('pr')
    expect(result.ciStatus).toBe('SUCCESS')
  })

  it('dispatches to mapPRNode when isDraft is present', () => {
    const node = { ...makeIssue(), isDraft: false } as unknown as GQLInboxPR
    node.reviewDecision = null
    const result = mapMixedNode(node)
    expect(result.type).toBe('pr')
  })

  it('dispatches to mapIssueNode for plain issues', () => {
    const result = mapMixedNode(makeIssue())
    expect(result.type).toBe('issue')
    expect(result.isDraft).toBeUndefined()
    expect(result.ciStatus).toBeUndefined()
  })
})
