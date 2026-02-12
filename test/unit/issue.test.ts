import { describe, expect, it } from 'vitest'
import { toIssue } from '../../shared/utils/issue'
import type { GraphQLIssueNode } from '../../shared/types/issue'

const baseNode: GraphQLIssueNode = {
  id: 'I_1',
  number: 42,
  title: 'Bug report',
  state: 'OPEN',
  stateReason: null,
  url: 'https://github.com/org/repo/issues/42',
  createdAt: '2025-06-01T00:00:00Z',
  updatedAt: '2025-06-02T00:00:00Z',
  closedAt: null,
  author: { login: 'alice', avatarUrl: 'https://a.com/alice.png' },
  labels: { nodes: [{ name: 'bug', color: 'ff0000' }] },
  assignees: { nodes: [{ login: 'bob', avatarUrl: 'https://a.com/bob.png' }] },
  milestone: { title: 'v1.0' },
  comments: { totalCount: 5, nodes: [{ author: { login: 'alice' } }, { author: { login: 'maintainer' } }] },
  timelineItems: { totalCount: 2 },
  repository: { nameWithOwner: 'org/repo', name: 'repo', owner: { login: 'org' } },
}

describe('toIssue', () => {
  it('maps GraphQL node to flat Issue', () => {
    const result = toIssue(baseNode, 'maintainer')

    expect(result.id).toBe('I_1')
    expect(result.number).toBe(42)
    expect(result.title).toBe('Bug report')
    expect(result.state).toBe('OPEN')
    expect(result.author.login).toBe('alice')
    expect(result.labels).toEqual([{ name: 'bug', color: 'ff0000' }])
    expect(result.assignees).toHaveLength(1)
    expect(result.assignees[0].login).toBe('bob')
  })

  it('extracts milestone title, returns null when missing', () => {
    expect(toIssue(baseNode, 'maintainer').milestone).toBe('v1.0')
    expect(toIssue({ ...baseNode, milestone: null }, 'maintainer').milestone).toBeNull()
  })

  it('flattens comment and linked PR counts', () => {
    const result = toIssue(baseNode, 'maintainer')
    expect(result.commentCount).toBe(5)
    expect(result.linkedPrCount).toBe(2)
  })

  it('flattens repository owner to string', () => {
    const result = toIssue(baseNode, 'maintainer')
    expect(result.repository.nameWithOwner).toBe('org/repo')
    expect(result.repository.owner).toBe('org')
    expect(result.repository.name).toBe('repo')
  })

  it('falls back to ghost author when author is null', () => {
    const result = toIssue({ ...baseNode, author: null }, 'maintainer')
    expect(result.author.login).toBe('ghost')
    expect(result.author.avatarUrl).toBe('')
  })

  it('handles closed issue with stateReason', () => {
    const closed = { ...baseNode, state: 'CLOSED' as const, stateReason: 'NOT_PLANNED' as const, closedAt: '2025-06-03T00:00:00Z' }
    const result = toIssue(closed, 'maintainer')
    expect(result.state).toBe('CLOSED')
    expect(result.stateReason).toBe('NOT_PLANNED')
    expect(result.closedAt).toBe('2025-06-03T00:00:00Z')
  })

  it('sets maintainerCommented true when maintainer has commented', () => {
    const result = toIssue(baseNode, 'maintainer')
    expect(result.maintainerCommented).toBe(true)
  })

  it('sets maintainerCommented false when maintainer has not commented', () => {
    const node = { ...baseNode, comments: { totalCount: 2, nodes: [{ author: { login: 'alice' } }] } }
    const result = toIssue(node, 'maintainer')
    expect(result.maintainerCommented).toBe(false)
  })
})
