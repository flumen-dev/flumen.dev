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
