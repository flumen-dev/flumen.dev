import type { PRHealthCategory, PRHealthItem, PRHealthResponse } from '~~/shared/types/pr-health'
import { daysBetween } from './date'

export const STALE_DRAFT_DAYS = 14

export const CATEGORY_PRIORITY: PRHealthCategory[] = [
  'ci-failing',
  'merge-conflict',
  'approved-not-merged',
  'needs-reviewers',
  'stale-draft',
]

export interface GQLPRNode {
  number: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  isDraft: boolean
  additions: number
  deletions: number
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  headRefName: string
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  repository: { nameWithOwner: string }
  author: { login: string, avatarUrl: string }
  labels: { nodes: Array<{ name: string, color: string }> }
  reviewRequests: { nodes: Array<{ requestedReviewer: { login: string, avatarUrl: string } | null }> }
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> }
}

export function extractCIState(node: GQLPRNode): PRHealthItem['ciStatus'] {
  const rollup = node.commits.nodes[0]?.commit.statusCheckRollup
  return (rollup?.state as PRHealthItem['ciStatus']) ?? null
}

export function mapNode(node: GQLPRNode, category: PRHealthCategory, now: Date): PRHealthItem {
  return {
    category,
    number: node.number,
    title: node.title,
    url: node.url,
    repo: node.repository.nameWithOwner,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    ageDays: daysBetween(node.createdAt, now),
    isDraft: node.isDraft,
    additions: node.additions,
    deletions: node.deletions,
    ciStatus: extractCIState(node),
    mergeable: node.mergeable,
    reviewDecision: node.reviewDecision,
    author: node.author,
    labels: node.labels.nodes,
    headRefName: node.headRefName,
    requestedReviewers: node.reviewRequests.nodes
      .map(n => n.requestedReviewer)
      .filter((r): r is { login: string, avatarUrl: string } => r !== null),
  }
}

export function computeSummary(items: PRHealthItem[]): PRHealthResponse['summary'] {
  return {
    totalIssues: items.length,
    ciFailures: items.filter(i => i.category === 'ci-failing').length,
    conflicts: items.filter(i => i.category === 'merge-conflict').length,
  }
}

/**
 * Deduplicates items by repo#number, keeping the highest-severity category.
 */
export function deduplicateItems(items: PRHealthItem[]): PRHealthItem[] {
  const seen = new Map<string, PRHealthItem>()

  for (const item of items) {
    const key = `${item.repo}#${item.number}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, item)
      continue
    }
    const existingPriority = CATEGORY_PRIORITY.indexOf(existing.category)
    const newPriority = CATEGORY_PRIORITY.indexOf(item.category)
    if (newPriority < existingPriority) {
      seen.set(key, item)
    }
  }

  return [...seen.values()]
}

/**
 * Classifies a base-query PR node into health categories.
 * A single PR can produce multiple items (e.g. ci-failing AND merge-conflict).
 */
export function classifyBaseNode(node: GQLPRNode, now: Date): PRHealthItem[] {
  const items: PRHealthItem[] = []
  const ciState = extractCIState(node)

  if (ciState === 'FAILURE' || ciState === 'ERROR') {
    items.push(mapNode(node, 'ci-failing', now))
  }
  if (node.mergeable === 'CONFLICTING') {
    items.push(mapNode(node, 'merge-conflict', now))
  }
  if (node.isDraft && daysBetween(node.createdAt, now) >= STALE_DRAFT_DAYS) {
    items.push(mapNode(node, 'stale-draft', now))
  }

  return items
}
