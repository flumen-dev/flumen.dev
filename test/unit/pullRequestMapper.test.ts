import { describe, expect, it } from 'vitest'
import type { GraphQLPullRequestNode } from '../../shared/utils/pull-request'
import { toPullRequest } from '../../shared/utils/pull-request'

function makeNode(overrides: Partial<GraphQLPullRequestNode> = {}): GraphQLPullRequestNode {
  return {
    id: 'PR_1',
    number: 42,
    title: 'Test PR',
    state: 'OPEN',
    isDraft: false,
    url: 'https://github.com/org/repo/pull/42',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    closedAt: null,
    mergedAt: null,
    additions: 10,
    deletions: 2,
    changedFiles: 3,
    headRefName: 'feat/test',
    baseRefName: 'main',
    mergeable: 'MERGEABLE',
    reviewDecision: null,
    author: { login: 'alice', avatarUrl: 'https://example.com/a.png' },
    labels: { nodes: [] },
    assignees: { nodes: [] },
    reviewRequests: { nodes: [] },
    comments: { totalCount: 0 },
    closingIssuesReferences: { totalCount: 0 },
    commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
    latestReviews: { nodes: [] },
    repository: {
      nameWithOwner: 'org/repo',
      name: 'repo',
      owner: { login: 'org' },
    },
    ...overrides,
  }
}

describe('toPullRequest', () => {
  it('maps basic fields straight through', () => {
    const pr = toPullRequest(makeNode())
    expect(pr.id).toBe('PR_1')
    expect(pr.number).toBe(42)
    expect(pr.title).toBe('Test PR')
    expect(pr.state).toBe('OPEN')
    expect(pr.isDraft).toBe(false)
    expect(pr.author.login).toBe('alice')
    expect(pr.headRefName).toBe('feat/test')
    expect(pr.baseRefName).toBe('main')
    expect(pr.repository.nameWithOwner).toBe('org/repo')
  })

  it('flattens nested arrays into the row-level shape', () => {
    const pr = toPullRequest(makeNode({
      labels: { nodes: [{ name: 'bug', color: 'ff0000' }] },
      assignees: { nodes: [{ login: 'bob', avatarUrl: 'b.png' }] },
      comments: { totalCount: 7 },
      closingIssuesReferences: { totalCount: 2 },
    }))
    expect(pr.labels).toEqual([{ name: 'bug', color: 'ff0000' }])
    expect(pr.assignees).toEqual([{ login: 'bob', avatarUrl: 'b.png' }])
    expect(pr.commentCount).toBe(7)
    expect(pr.linkedIssueCount).toBe(2)
  })

  it('falls back to ghost when author is null (deleted account)', () => {
    const pr = toPullRequest(makeNode({ author: null }))
    expect(pr.author.login).toBe('ghost')
    expect(pr.author.avatarUrl).toBe('')
  })

  it('filters out null requested reviewers (e.g. deleted users / unsupported types)', () => {
    const pr = toPullRequest(makeNode({
      reviewRequests: {
        nodes: [
          { requestedReviewer: { login: 'reviewer1', avatarUrl: 'r1.png' } },
          { requestedReviewer: null },
          { requestedReviewer: { login: 'reviewer2', avatarUrl: 'r2.png' } },
        ],
      },
    }))
    expect(pr.requestedReviewers).toEqual([
      { login: 'reviewer1', avatarUrl: 'r1.png' },
      { login: 'reviewer2', avatarUrl: 'r2.png' },
    ])
  })

  it.each([
    ['SUCCESS'],
    ['FAILURE'],
    ['ERROR'],
    ['PENDING'],
    ['EXPECTED'],
  ] as const)('extracts known CI state %s', (state) => {
    const pr = toPullRequest(makeNode({
      commits: { nodes: [{ commit: { statusCheckRollup: { state } } }] },
    }))
    expect(pr.ciStatus).toBe(state)
  })

  it('returns null ciStatus when no statusCheckRollup is present (no CI configured)', () => {
    const pr = toPullRequest(makeNode({
      commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
    }))
    expect(pr.ciStatus).toBeNull()
  })

  it('returns null ciStatus for unrecognized rollup states', () => {
    const pr = toPullRequest(makeNode({
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'UNRECOGNIZED' } } }] },
    }))
    expect(pr.ciStatus).toBeNull()
  })

  it('returns null ciStatus when commits array is empty', () => {
    const pr = toPullRequest(makeNode({
      commits: { nodes: [] },
    }))
    expect(pr.ciStatus).toBeNull()
  })

  it('preserves reviewDecision and mergeable verbatim', () => {
    const pr = toPullRequest(makeNode({
      reviewDecision: 'APPROVED',
      mergeable: 'CONFLICTING',
    }))
    expect(pr.reviewDecision).toBe('APPROVED')
    expect(pr.mergeable).toBe('CONFLICTING')
  })

  it('maps latestReviews into the row-level shape', () => {
    const pr = toPullRequest(makeNode({
      latestReviews: {
        nodes: [
          { state: 'APPROVED', author: { login: 'alice', avatarUrl: 'a.png' } },
          { state: 'CHANGES_REQUESTED', author: { login: 'bob', avatarUrl: 'b.png' } },
        ],
      },
    }))
    expect(pr.latestReviews).toEqual([
      { state: 'APPROVED', author: { login: 'alice', avatarUrl: 'a.png' } },
      { state: 'CHANGES_REQUESTED', author: { login: 'bob', avatarUrl: 'b.png' } },
    ])
  })

  it('drops latestReviews entries whose author is null (deleted accounts)', () => {
    const pr = toPullRequest(makeNode({
      latestReviews: {
        nodes: [
          { state: 'APPROVED', author: { login: 'alice', avatarUrl: 'a.png' } },
          { state: 'COMMENTED', author: null },
        ],
      },
    }))
    expect(pr.latestReviews).toHaveLength(1)
    expect(pr.latestReviews[0]?.author.login).toBe('alice')
  })
})
