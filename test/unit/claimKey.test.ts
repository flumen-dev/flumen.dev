import { describe, expect, it } from 'vitest'
import { parseClaimKey } from '../../shared/utils/claimKey'

describe('parseClaimKey', () => {
  it('parses standard fs-driver key format', () => {
    expect(parseClaimKey('issue-claims:Flo0806:test#4'))
      .toEqual({ repo: 'Flo0806/test', number: 4 })
  })

  it('parses key with org/repo', () => {
    expect(parseClaimKey('issue-claims:flumen-dev:flumen.dev#99'))
      .toEqual({ repo: 'flumen-dev/flumen.dev', number: 99 })
  })

  it('parses key with dots in repo name', () => {
    expect(parseClaimKey('issue-claims:owner:my.repo.name#123'))
      .toEqual({ repo: 'owner/my.repo.name', number: 123 })
  })

  it('parses key with hyphens in owner and repo', () => {
    expect(parseClaimKey('issue-claims:my-org:my-repo#1'))
      .toEqual({ repo: 'my-org/my-repo', number: 1 })
  })

  it('returns null for invalid key without prefix', () => {
    expect(parseClaimKey('random-key:foo:bar#1')).toBeNull()
  })

  it('returns null for key without issue number', () => {
    expect(parseClaimKey('issue-claims:owner:repo')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseClaimKey('')).toBeNull()
  })

  it('returns null for key with missing repo', () => {
    expect(parseClaimKey('issue-claims:owner#5')).toBeNull()
  })
})
