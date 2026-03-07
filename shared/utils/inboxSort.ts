import type { UnifiedInboxItem } from '~~/shared/types/inbox'

const REVIEW_ORDER: Record<string, number> = {
  CHANGES_REQUESTED: 0,
  REVIEW_REQUIRED: 1,
  APPROVED: 2,
}

export function urgencyScore(item: UnifiedInboxItem): number {
  const staleDays = Math.max(0, Math.floor((Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000))
  let score = staleDays * 2
  if (item.ciStatus === 'FAILURE') score += 5
  if (item.reviewDecision === 'CHANGES_REQUESTED') score += 3
  if (item.mergeable === 'CONFLICTING') score += 4
  return score
}

export function applySortToPage(items: UnifiedInboxItem[], sort: string): UnifiedInboxItem[] {
  if (sort === 'updated' || sort === 'age') return items // GitHub already sorted
  if (sort === 'urgency') return items.sort((a, b) => urgencyScore(b) - urgencyScore(a))
  // reviewState
  return items.sort((a, b) => {
    const aOrder = a.reviewDecision ? (REVIEW_ORDER[a.reviewDecision] ?? 3) : 3
    const bOrder = b.reviewDecision ? (REVIEW_ORDER[b.reviewDecision] ?? 3) : 3
    return aOrder - bOrder
  })
}
