import { describe, expect, it } from 'vitest'

// Pure logic extracted from ContributionGraph.vue for unit testing

function intensity(count: number, maxCount: number): number {
  if (count === 0 || maxCount === 0) return 0
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function heatmapFill(level: number, skinBase: string): string {
  if (level === 0) return 'var(--ui-bg-accented)'
  const pct = [0, 25, 50, 75, 100][level]
  return `color-mix(in oklab, ${skinBase} ${pct}%, var(--ui-bg-accented))`
}

function cellBg(count: number, maxCount: number, skin: string): string {
  const level = intensity(count, maxCount)
  if (skin === 'grass') {
    return level > 0 ? '#3b2617' : 'var(--ui-bg-accented)'
  }
  const skinBaseColors: Record<string, string> = {
    default: 'var(--ui-primary)',
    fire: '#ef4444',
  }
  return heatmapFill(level, skinBaseColors[skin] ?? 'var(--ui-primary)')
}

describe('intensity', () => {
  it('returns 0 for zero count', () => {
    expect(intensity(0, 20)).toBe(0)
  })

  it('returns 0 when maxCount is 0', () => {
    expect(intensity(5, 0)).toBe(0)
  })

  it('returns 1 for ratio <= 0.25', () => {
    expect(intensity(5, 20)).toBe(1)
    expect(intensity(1, 20)).toBe(1)
  })

  it('returns 2 for ratio <= 0.5', () => {
    expect(intensity(10, 20)).toBe(2)
    expect(intensity(6, 20)).toBe(2)
  })

  it('returns 3 for ratio <= 0.75', () => {
    expect(intensity(15, 20)).toBe(3)
    expect(intensity(11, 20)).toBe(3)
  })

  it('returns 4 for ratio > 0.75', () => {
    expect(intensity(16, 20)).toBe(4)
    expect(intensity(20, 20)).toBe(4)
  })

  it('returns exact boundary values correctly', () => {
    // 5/20 = 0.25 => level 1
    expect(intensity(5, 20)).toBe(1)
    // 10/20 = 0.5 => level 2
    expect(intensity(10, 20)).toBe(2)
    // 15/20 = 0.75 => level 3
    expect(intensity(15, 20)).toBe(3)
  })
})

describe('heatmapFill', () => {
  it('returns accented bg for level 0', () => {
    expect(heatmapFill(0, 'var(--ui-primary)')).toBe('var(--ui-bg-accented)')
  })

  it('returns color-mix for level 1 (25%)', () => {
    expect(heatmapFill(1, '#ef4444')).toBe('color-mix(in oklab, #ef4444 25%, var(--ui-bg-accented))')
  })

  it('returns color-mix for level 4 (100%)', () => {
    expect(heatmapFill(4, '#22c55e')).toBe('color-mix(in oklab, #22c55e 100%, var(--ui-bg-accented))')
  })
})

describe('cellBg', () => {
  it('grass skin returns earth brown for active cells', () => {
    expect(cellBg(5, 20, 'grass')).toBe('#3b2617')
  })

  it('grass skin returns accented bg for zero count', () => {
    expect(cellBg(0, 20, 'grass')).toBe('var(--ui-bg-accented)')
  })

  it('fire skin uses red base color', () => {
    expect(cellBg(20, 20, 'fire')).toContain('#ef4444')
  })

  it('default skin uses primary color', () => {
    expect(cellBg(20, 20, 'default')).toContain('var(--ui-primary)')
  })

  it('returns accented bg for zero count on all skins', () => {
    expect(cellBg(0, 20, 'default')).toBe('var(--ui-bg-accented)')
    expect(cellBg(0, 20, 'grass')).toBe('var(--ui-bg-accented)')
    expect(cellBg(0, 20, 'fire')).toBe('var(--ui-bg-accented)')
  })
})
