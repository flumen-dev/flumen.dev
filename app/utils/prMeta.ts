export interface StatusIconConfig {
  name: string
  color: string
  spin?: boolean
}

// --- CI status ---

const ciIconMap: Record<string, StatusIconConfig> = {
  SUCCESS: { name: 'i-lucide-circle-check', color: 'text-emerald-500' },
  EXPECTED: { name: 'i-lucide-circle-check', color: 'text-emerald-500' },
  FAILURE: { name: 'i-lucide-circle-x', color: 'text-red-500' },
  ERROR: { name: 'i-lucide-circle-x', color: 'text-red-500' },
  PENDING: { name: 'i-lucide-loader-2', color: 'text-amber-400', spin: true },
}

/** @deprecated Use `getCIStatus` instead */
export type CIIconConfig = StatusIconConfig

export function getCIIcon(status: string | null | undefined): StatusIconConfig | null {
  if (!status) return null
  return ciIconMap[status] ?? null
}

// --- PR state ---

export function getPRStateIcon(state: string, isDraft = false): string {
  if (isDraft) return 'i-lucide-git-pull-request-draft'
  if (state === 'MERGED') return 'i-lucide-git-merge'
  if (state === 'CLOSED') return 'i-lucide-git-pull-request-closed'
  return 'i-lucide-git-pull-request'
}

export function getPRStateColor(state: string, isDraft = false): string {
  if (isDraft) return 'text-neutral-400'
  if (state === 'MERGED') return 'text-violet-500'
  if (state === 'CLOSED') return 'text-red-500'
  return 'text-emerald-500'
}

// --- Issue state ---

export function getIssueStateIcon(state: string, stateReason?: string | null): string {
  if (state === 'OPEN') return 'i-lucide-circle-dot'
  if (stateReason === 'NOT_PLANNED') return 'i-lucide-circle-slash'
  return 'i-lucide-check-circle'
}

export function getIssueStateColor(state: string, stateReason?: string | null): string {
  if (state === 'OPEN') return 'text-emerald-500'
  if (stateReason === 'NOT_PLANNED') return 'text-neutral-400'
  return 'text-violet-500'
}

// --- Duration formatting ---

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return ''
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

export function getPRSizeLabel(additions: number, deletions: number): string {
  const total = additions + deletions
  if (total <= 50) return 'S'
  if (total <= 200) return 'M'
  if (total <= 500) return 'L'
  return 'XL'
}

export function getPRSizeColor(additions: number, deletions: number): string {
  const total = additions + deletions
  if (total <= 50) return 'success'
  if (total <= 200) return 'primary'
  if (total <= 500) return 'warning'
  return 'error'
}
