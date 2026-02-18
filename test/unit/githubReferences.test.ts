import { describe, expect, it } from 'vitest'
import { createGitHubReferenceRegex, GITHUB_REFERENCE_INPUT_REGEX, parseGitHubReference } from '../../app/utils/githubReferences'

describe('githubReferences', () => {
  it('parses singular keywords', () => {
    expect(parseGitHubReference('close #123')).toEqual({ keyword: 'close', number: 123 })
    expect(parseGitHubReference('fix #42')).toEqual({ keyword: 'fix', number: 42 })
    expect(parseGitHubReference('resolve #9')).toEqual({ keyword: 'resolve', number: 9 })
  })

  it('parses plural keywords and trims whitespace', () => {
    expect(parseGitHubReference('  closes #123  ')).toEqual({ keyword: 'closes', number: 123 })
    expect(parseGitHubReference('fixes #42')).toEqual({ keyword: 'fixes', number: 42 })
    expect(parseGitHubReference('resolves #9')).toEqual({ keyword: 'resolves', number: 9 })
  })

  it('returns null for invalid content', () => {
    expect(parseGitHubReference('#123')).toBeNull()
    expect(parseGitHubReference('close 123')).toBeNull()
    expect(parseGitHubReference('closed #123')).toBeNull()
  })

  it('matches standalone references only', () => {
    const regex = createGitHubReferenceRegex('gi')
    const text = 'foo close #12 bar; xclose #13 should not match; fixes #88 works'
    const matches = Array.from(text.matchAll(regex)).map(m => m[0])

    expect(matches).toEqual(['close #12', 'fixes #88'])
  })

  it('matches input rule pattern with trailing whitespace', () => {
    expect(GITHUB_REFERENCE_INPUT_REGEX.test('closes #123 ')).toBe(true)
    expect(GITHUB_REFERENCE_INPUT_REGEX.test('closes #123')).toBe(false)
  })
})
