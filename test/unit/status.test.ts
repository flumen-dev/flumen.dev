import { describe, expect, it } from 'vitest'
import {
  shortcodeToUnicode,
  mapGitHubStatus,
  expiryToDate,
  STATUS_PRESETS,
} from '../../shared/types/status'
import type { GitHubStatusFields } from '../../shared/types/status'

describe('shortcodeToUnicode', () => {
  it('converts known preset shortcodes to unicode', () => {
    expect(shortcodeToUnicode(':ocean:')).toBe('🌊')
    expect(shortcodeToUnicode(':hammer:')).toBe('🔨')
    expect(shortcodeToUnicode(':dart:')).toBe('🎯')
    expect(shortcodeToUnicode(':coffee:')).toBe('☕')
    expect(shortcodeToUnicode(':palm_tree:')).toBe('🌴')
  })

  it('returns the input for unknown shortcodes', () => {
    expect(shortcodeToUnicode(':rocket:')).toBe(':rocket:')
    expect(shortcodeToUnicode(':unknown:')).toBe(':unknown:')
  })

  it('passes through unicode as-is', () => {
    expect(shortcodeToUnicode('🔨')).toBe('🔨')
    expect(shortcodeToUnicode('😀')).toBe('😀')
  })

  it('returns null for null or empty input', () => {
    expect(shortcodeToUnicode(null)).toBeNull()
    expect(shortcodeToUnicode('')).toBeNull()
  })
})

describe('mapGitHubStatus', () => {
  it('maps GraphQL fields to UserStatus', () => {
    const raw: GitHubStatusFields = {
      emoji: ':hammer:',
      message: 'Pushing commits',
      indicatesLimitedAvailability: true,
      expiresAt: '2026-03-01T00:00:00Z',
    }

    expect(mapGitHubStatus(raw)).toEqual({
      emoji: ':hammer:',
      message: 'Pushing commits',
      limitedAvailability: true,
      expiresAt: '2026-03-01T00:00:00Z',
    })
  })

  it('returns defaults for null status', () => {
    expect(mapGitHubStatus(null)).toEqual({
      emoji: null,
      message: null,
      limitedAvailability: false,
      expiresAt: null,
    })
  })

  it('handles partial status with null fields', () => {
    const raw: GitHubStatusFields = {
      emoji: null,
      message: 'Away',
      indicatesLimitedAvailability: false,
      expiresAt: null,
    }

    expect(mapGitHubStatus(raw)).toEqual({
      emoji: null,
      message: 'Away',
      limitedAvailability: false,
      expiresAt: null,
    })
  })
})

describe('expiryToDate', () => {
  it('returns null for "never"', () => {
    expect(expiryToDate('never')).toBeNull()
  })

  it('returns a future ISO date for "30m"', () => {
    const before = Date.now()
    const result = expiryToDate('30m')!
    const after = Date.now()
    const ts = new Date(result).getTime()

    expect(ts).toBeGreaterThanOrEqual(before + 30 * 60 * 1000)
    expect(ts).toBeLessThanOrEqual(after + 30 * 60 * 1000)
  })

  it('returns a future ISO date for "1h"', () => {
    const before = Date.now()
    const result = expiryToDate('1h')!
    const ts = new Date(result).getTime()

    expect(ts).toBeGreaterThanOrEqual(before + 60 * 60 * 1000)
  })

  it('returns a future ISO date for "4h"', () => {
    const before = Date.now()
    const result = expiryToDate('4h')!
    const ts = new Date(result).getTime()

    expect(ts).toBeGreaterThanOrEqual(before + 4 * 60 * 60 * 1000)
  })

  it('returns end of today for "today"', () => {
    const result = expiryToDate('today')!
    const date = new Date(result)

    expect(date.getHours()).toBe(23)
    expect(date.getMinutes()).toBe(59)
    expect(date.getSeconds()).toBe(59)
  })

  it('returns end of Sunday for "week"', () => {
    const result = expiryToDate('week')!
    const date = new Date(result)

    expect(date.getDay()).toBe(0) // Sunday
    expect(date.getHours()).toBe(23)
    expect(date.getMinutes()).toBe(59)
    expect(date.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('STATUS_PRESETS', () => {
  it('has a shortcode map entry for every preset', () => {
    for (const preset of STATUS_PRESETS) {
      expect(shortcodeToUnicode(preset.emoji)).toBe(preset.emojiUnicode)
    }
  })

  it('has unique keys', () => {
    const keys = STATUS_PRESETS.map(p => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
