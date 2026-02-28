import { describe, expect, it } from 'vitest'
import { chunkArray, sanitizeGraphQL } from '../../server/utils/github-graphql'

describe('chunkArray', () => {
  it('splits array into correct chunks', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns empty array for empty input', () => {
    expect(chunkArray([], 3)).toEqual([])
  })

  it('returns single chunk when size >= length', () => {
    expect(chunkArray([1, 2, 3], 5)).toEqual([[1, 2, 3]])
    expect(chunkArray([1, 2, 3], 3)).toEqual([[1, 2, 3]])
  })

  it('handles chunk size of 1', () => {
    expect(chunkArray([1, 2, 3], 1)).toEqual([[1], [2], [3]])
  })
})

describe('sanitizeGraphQL', () => {
  it('strips double quotes', () => {
    expect(sanitizeGraphQL('hello "world"')).toBe('hello world')
  })

  it('strips backslashes', () => {
    expect(sanitizeGraphQL('path\\to\\thing')).toBe('pathtothing')
  })

  it('strips newlines and carriage returns', () => {
    expect(sanitizeGraphQL('line1\nline2\rline3')).toBe('line1line2line3')
  })

  it('passes normal strings through unchanged', () => {
    expect(sanitizeGraphQL('org/repo')).toBe('org/repo')
  })

  it('handles empty string', () => {
    expect(sanitizeGraphQL('')).toBe('')
  })
})
