export type IssueSectionKey
  = | 'needs-response'
    | 'fresh-unassigned'
    | 'in-progress'
    | 'stale'
    | 'other-open'

export interface IssueSectionDef {
  key: IssueSectionKey
  iconKey: string
  iconClass: string
  defaultCollapsed: boolean
}

export const ISSUE_SECTIONS: IssueSectionDef[] = [
  { key: 'needs-response', iconKey: 'i-lucide-circle-dot', iconClass: 'text-rose-500', defaultCollapsed: false },
  { key: 'fresh-unassigned', iconKey: 'i-lucide-sparkles', iconClass: 'text-amber-500', defaultCollapsed: false },
  { key: 'in-progress', iconKey: 'i-lucide-circle-check', iconClass: 'text-emerald-500', defaultCollapsed: false },
  { key: 'stale', iconKey: 'i-lucide-hourglass', iconClass: 'text-neutral-400', defaultCollapsed: true },
  { key: 'other-open', iconKey: 'i-lucide-package', iconClass: 'text-neutral-500', defaultCollapsed: false },
]

export const ISSUE_SECTION_KEYS: IssueSectionKey[] = ISSUE_SECTIONS.map(s => s.key)

const FRESH_DAYS = 7
const STALE_DAYS = 30
const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Buckets an issue into one of the smart sections. Rules are checked in
 * priority order, first match wins. Closed issues fall through to `other-open`
 * since the section labels are open-issue oriented.
 */
export function categorizeIssue(issue: Issue, currentLogin: string | null): IssueSectionKey {
  if (issue.state === 'CLOSED') return 'other-open'

  const now = Date.now()
  const ageDays = (now - new Date(issue.updatedAt).getTime()) / MS_PER_DAY
  const createdDays = (now - new Date(issue.createdAt).getTime()) / MS_PER_DAY

  // Maintainer-relevant only when the viewer is signed in. Uses the latest
  // comment's author (not just "ever commented") so an issue still surfaces here
  // when the maintainer engaged earlier and the discussion has moved on without them.
  if (
    currentLogin
    && issue.commentCount > 0
    && issue.lastComment
    && issue.lastComment.author.login !== currentLogin
  ) {
    return 'needs-response'
  }
  if (createdDays < FRESH_DAYS && issue.assignees.length === 0 && issue.linkedPrCount === 0) {
    return 'fresh-unassigned'
  }
  if (issue.assignees.length > 0 && issue.linkedPrCount > 0) {
    return 'in-progress'
  }
  if (ageDays > STALE_DAYS) {
    return 'stale'
  }
  return 'other-open'
}

/** Empty bucket map keyed by every section. */
export function createEmptyIssueBuckets(): Record<IssueSectionKey, Issue[]> {
  return ISSUE_SECTION_KEYS.reduce<Record<IssueSectionKey, Issue[]>>((acc, k) => {
    acc[k] = []
    return acc
  }, {} as Record<IssueSectionKey, Issue[]>)
}
