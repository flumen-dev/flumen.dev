export interface CIIconConfig {
  name: string
  color: string
  spin?: boolean
}

const ciIconMap: Record<string, CIIconConfig> = {
  SUCCESS: { name: 'i-lucide-circle-check', color: 'text-emerald-500' },
  EXPECTED: { name: 'i-lucide-circle-check', color: 'text-emerald-500' },
  FAILURE: { name: 'i-lucide-circle-x', color: 'text-red-500' },
  ERROR: { name: 'i-lucide-circle-x', color: 'text-red-500' },
  PENDING: { name: 'i-lucide-loader-2', color: 'text-amber-400', spin: true },
}

export function getCIIcon(status: string | null | undefined): CIIconConfig | null {
  if (!status) return null
  return ciIconMap[status] ?? null
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
