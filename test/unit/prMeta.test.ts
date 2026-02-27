import { describe, expect, it } from 'vitest'
import { getCIIcon, getPRSizeLabel, getPRSizeColor } from '../../app/utils/prMeta'

describe('getCIIcon', () => {
  it('maps known statuses to correct icons and colors', () => {
    expect(getCIIcon('SUCCESS')).toEqual({ name: 'i-lucide-circle-check', color: 'text-emerald-500' })
    expect(getCIIcon('FAILURE')).toEqual({ name: 'i-lucide-circle-x', color: 'text-red-500' })
    expect(getCIIcon('PENDING')).toEqual({ name: 'i-lucide-loader-2', color: 'text-amber-400', spin: true })
    expect(getCIIcon('ERROR')).toEqual({ name: 'i-lucide-circle-x', color: 'text-red-500' })
    expect(getCIIcon('EXPECTED')).toEqual({ name: 'i-lucide-circle-check', color: 'text-emerald-500' })
  })

  it('returns null for null, undefined, or unknown status', () => {
    expect(getCIIcon(null)).toBeNull()
    expect(getCIIcon(undefined)).toBeNull()
    expect(getCIIcon('UNKNOWN')).toBeNull()
  })
})

describe('getPRSizeLabel + getPRSizeColor', () => {
  it.each([
    { additions: 10, deletions: 5, label: 'S', color: 'success' },
    { additions: 50, deletions: 0, label: 'S', color: 'success' },
    { additions: 51, deletions: 0, label: 'M', color: 'primary' },
    { additions: 100, deletions: 100, label: 'M', color: 'primary' },
    { additions: 300, deletions: 50, label: 'L', color: 'warning' },
    { additions: 400, deletions: 200, label: 'XL', color: 'error' },
  ])('$additions+/$deletions- → $label ($color)', ({ additions, deletions, label, color }) => {
    expect(getPRSizeLabel(additions, deletions)).toBe(label)
    expect(getPRSizeColor(additions, deletions)).toBe(color)
  })
})
