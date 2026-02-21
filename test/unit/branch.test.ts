import { describe, expect, it } from 'vitest'
import { slugify, suggestBranchName } from '../../shared/utils/branch'

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Fix Login Bug')).toBe('fix-login-bug')
  })

  it('removes special characters', () => {
    expect(slugify('feat: add auth (OAuth2)')).toBe('feat-add-auth-oauth2')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('collapses multiple separators', () => {
    expect(slugify('a   b___c')).toBe('a-b-c')
  })

  it('truncates to 40 characters', () => {
    const long = 'this is a very long title that should be truncated at forty chars'
    expect(slugify(long).length).toBeLessThanOrEqual(40)
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('handles unicode characters', () => {
    expect(slugify('Ünïcödé tëst')).toBe('n-c-d-t-st')
  })
})

describe('suggestBranchName', () => {
  it('creates branch name from issue number and title', () => {
    expect(suggestBranchName(42, 'Fix login bug')).toBe('issue-42-fix-login-bug')
  })

  it('handles long titles by truncating slug', () => {
    const title = 'This is a very long issue title that exceeds the maximum slug length'
    const branch = suggestBranchName(123, title)
    expect(branch).toMatch(/^issue-123-/)
    expect(branch.length).toBeLessThanOrEqual(50) // issue-123- = 10 + max 40
  })

  it('handles titles with special characters', () => {
    expect(suggestBranchName(7, '[bug] React: crash on mount!')).toBe('issue-7-bug-react-crash-on-mount')
  })
})
