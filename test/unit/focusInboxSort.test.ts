import { describe, expect, it } from 'vitest'
import type { UnifiedInboxItem } from '../../shared/types/inbox'

// Mirrors the server's urgencyScore + sortItemsServer functions

function makeItem(
  number: number,
  overrides: Partial<UnifiedInboxItem> = {},
): UnifiedInboxItem {
  return {
    type: 'pr',
    number,
    title: `PR ${number}`,
    state: 'OPEN',
    url: `https://github.com/org/repo/pull/${number}`,
    repo: 'org/repo',
    updatedAt: new Date().toISOString(),
    author: { login: 'dev', avatarUrl: '' },
    labels: [],
    commentCount: 0,
    ...overrides,
  }
}

const REVIEW_ORDER: Record<string, number> = {
  CHANGES_REQUESTED: 0,
  REVIEW_REQUIRED: 1,
  APPROVED: 2,
}

function urgencyScore(item: UnifiedInboxItem): number {
  const staleDays = Math.max(0, Math.floor((Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000))
  let score = staleDays * 2
  if (item.ciStatus === 'FAILURE') score += 5
  if (item.reviewDecision === 'CHANGES_REQUESTED') score += 3
  if (item.mergeable === 'CONFLICTING') score += 4
  return score
}

function sortItems(items: UnifiedInboxItem[], sort: string): UnifiedInboxItem[] {
  const sorted = [...items]
  if (sort === 'urgency') return sorted.sort((a, b) => urgencyScore(b) - urgencyScore(a))
  // reviewState
  return sorted.sort((a, b) => {
    const aOrder = a.reviewDecision ? (REVIEW_ORDER[a.reviewDecision] ?? 3) : 3
    const bOrder = b.reviewDecision ? (REVIEW_ORDER[b.reviewDecision] ?? 3) : 3
    return aOrder - bOrder
  })
}

describe('urgency score', () => {
  it('scores CI failure + conflict + changes requested higher than fresh PR', () => {
    const problematic = makeItem(1, {
      updatedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      ciStatus: 'FAILURE',
      mergeable: 'CONFLICTING',
      reviewDecision: 'CHANGES_REQUESTED',
    })
    const fresh = makeItem(2, {
      updatedAt: new Date().toISOString(),
      ciStatus: 'SUCCESS',
      mergeable: 'MERGEABLE',
      reviewDecision: 'APPROVED',
    })
    expect(urgencyScore(problematic)).toBeGreaterThan(urgencyScore(fresh))
  })

  it('scores a 7-day stale PR without issues higher than a fresh PR with CI failure', () => {
    const stale = makeItem(1, {
      updatedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    })
    const freshCiFail = makeItem(2, {
      updatedAt: new Date().toISOString(),
      ciStatus: 'FAILURE',
    })
    // stale: 7*2=14, freshCiFail: 0*2+5=5
    expect(urgencyScore(stale)).toBeGreaterThan(urgencyScore(freshCiFail))
  })

  it('issues (no CI/review/mergeable) only score on staleness', () => {
    const issue = makeItem(1, { type: 'issue', updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() })
    expect(urgencyScore(issue)).toBe(6) // 3 days * 2
  })
})

describe('sort order', () => {
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const today = new Date().toISOString()

  const items = [
    makeItem(1, { updatedAt: today, ciStatus: 'SUCCESS', reviewDecision: 'APPROVED' }),
    makeItem(2, { updatedAt: sevenDaysAgo, ciStatus: 'FAILURE', reviewDecision: 'CHANGES_REQUESTED' }),
    makeItem(3, { updatedAt: threeDaysAgo, ciStatus: 'SUCCESS', reviewDecision: 'REVIEW_REQUIRED' }),
  ]

  it('urgency puts failing + stale PRs first', () => {
    const sorted = sortItems(items, 'urgency')
    expect(sorted[0]!.number).toBe(2) // 7d stale + CI fail + changes requested
  })

  it('reviewState puts CHANGES_REQUESTED before REVIEW_REQUIRED before APPROVED', () => {
    const sorted = sortItems(items, 'reviewState')
    expect(sorted.map(i => i.reviewDecision)).toEqual([
      'CHANGES_REQUESTED',
      'REVIEW_REQUIRED',
      'APPROVED',
    ])
  })

  it('reviewState puts items without reviewDecision last', () => {
    const withNull = [...items, makeItem(4, { reviewDecision: null })]
    const sorted = sortItems(withNull, 'reviewState')
    expect(sorted[sorted.length - 1]!.number).toBe(4)
  })
})
