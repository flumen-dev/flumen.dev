import type { Issue } from '~~/shared/types/issue'

/**
 * Layer 1 of the magical-search vision (#277): instant client-side ranking
 * over already-loaded issues. Runs synchronously on every keystroke without
 * a network roundtrip, so users see relevant matches before the debounced
 * server search even starts.
 *
 * Pure function. No side effects. Tested in test/unit/issueRanking.test.ts.
 */

const RECENCY_BOOST_LOOKBACK_DAYS = 30
const FUZZY_MIN_QUERY_LEN = 4
const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Classic Wagner–Fischer Levenshtein distance. Used for typo-tolerant matching. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const prev: number[] = []
  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    let curr = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1
      const next = Math.min(curr + 1, prev[j]! + 1, prev[j - 1]! + cost)
      prev[j - 1] = curr
      curr = next
    }
    prev[b.length] = curr
  }
  return prev[b.length]!
}

/**
 * Score a single issue against a normalized query. Higher = more relevant.
 * Returns 0 when the issue is not a meaningful match.
 */
export function scoreIssue(issue: Issue, query: string, currentLogin: string | null, now: number): number {
  const q = query.toLowerCase().trim()
  if (!q) return 0

  let score = 0
  const title = issue.title.toLowerCase()

  // 1. Issue-number direct match — strongest signal.
  const numMatch = q.match(/^#?(\d+)$/)
  if (numMatch && issue.number.toString() === numMatch[1]) {
    return 1000
  }

  // 2. Title matching, in descending strength.
  if (title === q) score += 250
  else if (title.startsWith(q)) score += 150
  else if (title.includes(q)) score += 100

  // 3. Word-prefix match (any word in title starts with query).
  const titleWords = title.split(/\s+/)
  if (titleWords.some(w => w.startsWith(q))) score += 40

  // 4. Fuzzy / typo tolerance (only for queries long enough to be meaningful).
  if (score === 0 && q.length >= FUZZY_MIN_QUERY_LEN) {
    const bestWordDistance = Math.min(
      ...titleWords.map(w => levenshtein(q, w)),
    )
    if (bestWordDistance <= 2) score += 60
    else if (bestWordDistance <= 3 && q.length >= 6) score += 30
  }

  // 5. Last-comment snippet match.
  if (issue.lastComment?.snippet.toLowerCase().includes(q)) score += 25

  // 6. Label match.
  if (issue.labels.some(l => l.name.toLowerCase().includes(q))) score += 35

  // 7. Author / assignee handle match.
  if (issue.author.login.toLowerCase().includes(q)) score += 30
  if (issue.assignees.some(a => a.login.toLowerCase().includes(q))) score += 30

  // 8. Milestone match.
  if (issue.milestone?.toLowerCase().includes(q)) score += 20

  if (score === 0) return 0

  // 9. Recency boost — recent activity edges out older matches at equal relevance.
  const daysOld = (now - new Date(issue.updatedAt).getTime()) / MS_PER_DAY
  if (daysOld < 1) score += 18
  else if (daysOld < 7) score += 10
  else if (daysOld < RECENCY_BOOST_LOOKBACK_DAYS) score += 4

  // 10. Viewer involvement — your stuff floats up on tie.
  if (currentLogin && issue.assignees.some(a => a.login === currentLogin)) score += 12
  if (currentLogin && issue.author.login === currentLogin) score += 8

  // 11. Discussion temperature — small bonus for active threads.
  score += Math.min(issue.commentCount, 5)

  return score
}

export interface ScoredIssue {
  issue: Issue
  score: number
}

/**
 * Rank a pool of issues with their scores. Returns entries with score > 0,
 * sorted descending. Stable on equal scores (preserves input order).
 * Use this when the score itself is needed (e.g. similarity threshold gating).
 */
export function rankIssuesScored(issues: Issue[], query: string, currentLogin: string | null): ScoredIssue[] {
  if (!query.trim()) return []
  const now = Date.now()
  const scored = issues
    .map((issue, index) => ({ issue, score: scoreIssue(issue, query, currentLogin, now), index }))
    .filter(entry => entry.score > 0)

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.index - b.index
  })

  return scored.map(({ issue, score }) => ({ issue, score }))
}

/** Convenience: rankIssuesScored without the score wrapper. */
export function rankIssues(issues: Issue[], query: string, currentLogin: string | null): Issue[] {
  return rankIssuesScored(issues, query, currentLogin).map(entry => entry.issue)
}
