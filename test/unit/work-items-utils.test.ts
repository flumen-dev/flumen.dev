import { beforeAll, describe, expect, it } from 'vitest'
import { parseWorkItemId } from '../../server/utils/work-items'

beforeAll(() => {
  ;(globalThis as { createError?: (input: { statusCode: number, message: string }) => Error & { statusCode: number } }).createError = ({ statusCode, message }) => {
    const error = new Error(message) as Error & { statusCode: number }
    error.statusCode = statusCode
    return error
  }
})

describe('work item id helpers', () => {
  it('parses valid numeric ids', () => {
    expect(parseWorkItemId('1')).toEqual({ number: 1 })
    expect(parseWorkItemId('42')).toEqual({ number: 42 })
  })

  it('parses legacy pr- prefixed ids', () => {
    expect(parseWorkItemId('pr-1')).toEqual({ number: 1 })
    expect(parseWorkItemId('pr-42')).toEqual({ number: 42 })
  })

  it('rejects non-positive, non-integer and malformed ids', () => {
    expect(() => parseWorkItemId('0')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('-2')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('1.5')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('abc')).toThrow('Invalid work item id')
  })

  it('rejects malformed pr- prefixed ids', () => {
    expect(() => parseWorkItemId('pr-0')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('pr--2')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('pr-1.5')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('pr-abc')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('pr-')).toThrow('Invalid work item id')
  })
})
