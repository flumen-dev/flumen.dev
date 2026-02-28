import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  getCIIcon,
  getIssueStateColor,
  getIssueStateIcon,
  getPRSizeColor,
  getPRSizeLabel,
  getPRStateColor,
  getPRStateIcon,
} from '../../app/utils/prMeta'

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

describe('getPRStateIcon + getPRStateColor', () => {
  it('maps MERGED to merge icon + violet', () => {
    expect(getPRStateIcon('MERGED')).toBe('i-lucide-git-merge')
    expect(getPRStateColor('MERGED')).toBe('text-violet-500')
  })

  it('maps CLOSED to closed icon + red', () => {
    expect(getPRStateIcon('CLOSED')).toBe('i-lucide-git-pull-request-closed')
    expect(getPRStateColor('CLOSED')).toBe('text-red-500')
  })

  it('draft overrides state for both icon and color', () => {
    expect(getPRStateIcon('OPEN', true)).toBe('i-lucide-git-pull-request-draft')
    expect(getPRStateIcon('MERGED', true)).toBe('i-lucide-git-pull-request-draft')
    expect(getPRStateColor('OPEN', true)).toBe('text-neutral-400')
  })

  it('defaults to open PR icon + emerald', () => {
    expect(getPRStateIcon('OPEN')).toBe('i-lucide-git-pull-request')
    expect(getPRStateColor('OPEN')).toBe('text-emerald-500')
  })
})

describe('getIssueStateIcon + getIssueStateColor', () => {
  it('maps OPEN to circle-dot + emerald', () => {
    expect(getIssueStateIcon('OPEN')).toBe('i-lucide-circle-dot')
    expect(getIssueStateColor('OPEN')).toBe('text-emerald-500')
  })

  it('maps NOT_PLANNED to slash + neutral', () => {
    expect(getIssueStateIcon('CLOSED', 'NOT_PLANNED')).toBe('i-lucide-circle-slash')
    expect(getIssueStateColor('CLOSED', 'NOT_PLANNED')).toBe('text-neutral-400')
  })

  it('maps completed to check-circle + violet', () => {
    expect(getIssueStateIcon('CLOSED')).toBe('i-lucide-check-circle')
    expect(getIssueStateColor('CLOSED')).toBe('text-violet-500')
  })
})

describe('formatDuration', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    [0, '0s'],
    [45, '45s'],
    [59, '59s'],
    [60, '1m 0s'],
    [125, '2m 5s'],
    [3661, '61m 1s'],
  ])('formatDuration(%s) → %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected)
  })
})
