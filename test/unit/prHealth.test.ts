import { describe, expect, it } from 'vitest'
import type { GQLPRNode } from '../../server/utils/pr-health'
import {
  classifyBaseNode,
  computeSummary,
  deduplicateItems,
} from '../../server/utils/pr-health'

function makeNode(overrides: Partial<GQLPRNode> = {}): GQLPRNode {
  return {
    number: 1,
    title: 'Test PR',
    url: 'https://github.com/org/repo/pull/1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    isDraft: false,
    additions: 10,
    deletions: 5,
    mergeable: 'MERGEABLE',
    headRefName: 'feature-branch',
    reviewDecision: null,
    repository: { nameWithOwner: 'org/repo' },
    author: { login: 'user', avatarUrl: 'https://example.com/avatar' },
    labels: { nodes: [] },
    reviewRequests: { nodes: [] },
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
    ...overrides,
  }
}

const NOW = new Date('2026-02-27T00:00:00Z')

describe('classifyBaseNode', () => {
  it('detects ci-failing from FAILURE status', () => {
    const node = makeNode({
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
    })
    const items = classifyBaseNode(node, NOW)
    expect(items).toHaveLength(1)
    expect(items[0].category).toBe('ci-failing')
  })

  it('detects merge-conflict', () => {
    const node = makeNode({ mergeable: 'CONFLICTING' })
    const items = classifyBaseNode(node, NOW)
    expect(items).toHaveLength(1)
    expect(items[0].category).toBe('merge-conflict')
  })

  it('detects stale-draft when draft is older than 14 days', () => {
    const node = makeNode({ isDraft: true, createdAt: '2026-01-01T00:00:00Z' })
    const items = classifyBaseNode(node, NOW)
    expect(items).toHaveLength(1)
    expect(items[0].category).toBe('stale-draft')
  })

  it('ignores recent drafts (< 14 days)', () => {
    const node = makeNode({ isDraft: true, createdAt: '2026-02-20T00:00:00Z' })
    const items = classifyBaseNode(node, NOW)
    expect(items).toHaveLength(0)
  })

  it('classifies a single PR into multiple categories', () => {
    const node = makeNode({
      mergeable: 'CONFLICTING',
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'ERROR' } } }] },
    })
    const items = classifyBaseNode(node, NOW)
    expect(items).toHaveLength(2)
    const categories = items.map(i => i.category)
    expect(categories).toContain('ci-failing')
    expect(categories).toContain('merge-conflict')
  })

  it('returns empty for a healthy PR', () => {
    const node = makeNode()
    const items = classifyBaseNode(node, NOW)
    expect(items).toHaveLength(0)
  })
})

describe('deduplicateItems', () => {
  it('keeps highest-severity category when same PR has multiple issues', () => {
    const ciItem = { ...classifyBaseNode(makeNode({
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
    }), NOW)[0], repo: 'org/repo', number: 1 }
    const conflictItem = { ...classifyBaseNode(makeNode({
      mergeable: 'CONFLICTING',
    }), NOW)[0], repo: 'org/repo', number: 1 }

    // ci-failing has higher severity than merge-conflict
    const result = deduplicateItems([conflictItem, ciItem])
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('ci-failing')
  })

  it('keeps different PRs separate', () => {
    const item1 = classifyBaseNode(makeNode({
      number: 1,
      mergeable: 'CONFLICTING',
    }), NOW)[0]
    const item2 = classifyBaseNode(makeNode({
      number: 2,
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
    }), NOW)[0]

    const result = deduplicateItems([item1, item2])
    expect(result).toHaveLength(2)
  })
})

describe('computeSummary', () => {
  it('counts CI failures and conflicts correctly', () => {
    const items = [
      classifyBaseNode(makeNode({
        number: 1,
        commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
      }), NOW)[0],
      classifyBaseNode(makeNode({
        number: 2,
        commits: { nodes: [{ commit: { statusCheckRollup: { state: 'ERROR' } } }] },
      }), NOW)[0],
      classifyBaseNode(makeNode({
        number: 3,
        mergeable: 'CONFLICTING',
      }), NOW)[0],
    ]

    const summary = computeSummary(items)
    expect(summary.totalIssues).toBe(3)
    expect(summary.ciFailures).toBe(2)
    expect(summary.conflicts).toBe(1)
  })
})
