export type MergeStrategy = 'merge' | 'squash' | 'rebase'
export type MergeableState = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
export type MergeStateStatus = 'BEHIND' | 'BLOCKED' | 'CLEAN' | 'DIRTY' | 'DRAFT' | 'HAS_HOOKS' | 'UNKNOWN' | 'UNSTABLE'

export interface MergeStatusResult {
  canMerge: boolean
  mergeable: MergeableState
  mergeState: MergeStateStatus
  allowedStrategies: MergeStrategy[]
  defaultStrategy: MergeStrategy
  headBranch: string
  baseBranch: string
  commitCount: number
  defaultTitle: string
  defaultBody: string
  headSha: string
  canBypassRules: boolean
}
