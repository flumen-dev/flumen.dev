import { describe, expect, it } from 'vitest'
import type { Issue } from '../../shared/types/issue'
import { levenshtein, rankIssues, scoreIssue } from '../../app/utils/issueRanking'

const NOW = Date.now()
const days = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

const baseIssue: Issue = {
  id: 'I_1',
  number: 42,
  title: 'Fix login bug',
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
  lastComment: null,
  repository: { nameWithOwner: 'org/repo', name: 'repo', owner: 'org' },
}

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('login', 'login')).toBe(0)
  })

  it('counts a single substitution', () => {
    expect(levenshtein('login', 'logon')).toBe(1)
  })

  it('counts a single deletion', () => {
    expect(levenshtein('login', 'logn')).toBe(1)
  })

  it('counts a single insertion', () => {
    expect(levenshtein('logn', 'login')).toBe(1)
  })

  it('handles empty strings', () => {
    expect(levenshtein('', 'login')).toBe(5)
    expect(levenshtein('login', '')).toBe(5)
  })
})

describe('scoreIssue', () => {
  it('scores 0 for unrelated query', () => {
    expect(scoreIssue(baseIssue, 'completely-different', null, NOW)).toBe(0)
  })

  it('returns the dedicated #number-match score', () => {
    expect(scoreIssue(baseIssue, '#42', null, NOW)).toBe(1000)
    expect(scoreIssue(baseIssue, '42', null, NOW)).toBe(1000)
  })

  it('boosts exact title match above substring', () => {
    const exact = scoreIssue({ ...baseIssue, title: 'login' }, 'login', null, NOW)
    const substring = scoreIssue({ ...baseIssue, title: 'fix login bug' }, 'login', null, NOW)
    expect(exact).toBeGreaterThan(substring)
  })

  it('boosts title-prefix match above mid-substring', () => {
    const prefix = scoreIssue({ ...baseIssue, title: 'login fails on rate limit' }, 'login', null, NOW)
    const middle = scoreIssue({ ...baseIssue, title: 'fix login bug' }, 'login', null, NOW)
    expect(prefix).toBeGreaterThan(middle)
  })

  it('catches typos via fuzzy match (logn → login)', () => {
    const fuzzy = scoreIssue(baseIssue, 'logn', null, NOW)
    expect(fuzzy).toBeGreaterThan(0)
  })

  it('does not fuzzy-match very short queries', () => {
    expect(scoreIssue(baseIssue, 'lg', null, NOW)).toBe(0)
  })

  it('matches on label name', () => {
    const i = { ...baseIssue, title: 'unrelated', labels: [{ name: 'bug', color: 'ff0000' }] }
    expect(scoreIssue(i, 'bug', null, NOW)).toBeGreaterThan(0)
  })

  it('matches on author handle', () => {
    const i = { ...baseIssue, title: 'unrelated', author: { login: 'flo0806', avatarUrl: '' } }
    expect(scoreIssue(i, 'flo0806', null, NOW)).toBeGreaterThan(0)
  })

  it('matches on assignee handle', () => {
    const i = { ...baseIssue, title: 'unrelated', assignees: [{ login: 'flo0806', avatarUrl: '' }] }
    expect(scoreIssue(i, 'flo0806', null, NOW)).toBeGreaterThan(0)
  })

  it('matches on last-comment snippet', () => {
    const i = { ...baseIssue, title: 'unrelated', commentCount: 1, lastComment: { author: { login: 'bob', avatarUrl: '' }, snippet: 'looks good please merge', createdAt: days(0) } }
    expect(scoreIssue(i, 'merge', null, NOW)).toBeGreaterThan(0)
  })

  it('boosts viewer-assigned issues at equal text relevance', () => {
    const someoneElse = scoreIssue({ ...baseIssue, assignees: [{ login: 'bob', avatarUrl: '' }] }, 'login', 'me', NOW)
    const mine = scoreIssue({ ...baseIssue, assignees: [{ login: 'me', avatarUrl: '' }] }, 'login', 'me', NOW)
    expect(mine).toBeGreaterThan(someoneElse)
  })

  it('gives a recency boost to recently updated issues', () => {
    const fresh = scoreIssue({ ...baseIssue, updatedAt: days(0) }, 'login', null, NOW)
    const stale = scoreIssue({ ...baseIssue, updatedAt: days(60) }, 'login', null, NOW)
    expect(fresh).toBeGreaterThan(stale)
  })
})

describe('rankIssues', () => {
  it('returns empty for empty query', () => {
    expect(rankIssues([baseIssue], '', null)).toEqual([])
  })

  it('orders results by score descending', () => {
    const exact: Issue = { ...baseIssue, id: 'I_exact', title: 'login' }
    const partial: Issue = { ...baseIssue, id: 'I_partial', title: 'fix login bug' }
    const unrelated: Issue = { ...baseIssue, id: 'I_unrelated', title: 'something else' }
    const ranked = rankIssues([unrelated, partial, exact], 'login', null)
    expect(ranked.map(i => i.id)).toEqual(['I_exact', 'I_partial'])
  })

  it('drops issues that score zero', () => {
    const ranked = rankIssues([baseIssue], 'totallyunrelated', null)
    expect(ranked).toEqual([])
  })

  it('preserves input order on equal score (stable sort)', () => {
    const a: Issue = { ...baseIssue, id: 'A', title: 'login something' }
    const b: Issue = { ...baseIssue, id: 'B', title: 'login something' }
    expect(rankIssues([a, b], 'login', null).map(i => i.id)).toEqual(['A', 'B'])
    expect(rankIssues([b, a], 'login', null).map(i => i.id)).toEqual(['B', 'A'])
  })

  it('issue-by-number wins over title-text matches', () => {
    const byNumber: Issue = { ...baseIssue, id: 'I_42', number: 42, title: 'unrelated' }
    const byTitle: Issue = { ...baseIssue, id: 'I_title', number: 99, title: 'something with 42 in it' }
    const ranked = rankIssues([byTitle, byNumber], '#42', null)
    expect(ranked[0]?.id).toBe('I_42')
  })
})
