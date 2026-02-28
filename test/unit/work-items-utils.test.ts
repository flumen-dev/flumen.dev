import { beforeAll, describe, expect, it } from 'vitest'
import { parseWorkItemId, workItemIdFromIssue, workItemIdFromPull } from '../../server/utils/work-items'

beforeAll(() => {
  ;(globalThis as { createError?: (input: { statusCode: number, message: string }) => Error & { statusCode: number } }).createError = ({ statusCode, message }) => {
    const error = new Error(message) as Error & { statusCode: number }
    error.statusCode = statusCode
    return error
  }
})

describe('work item id helpers', () => {
  it('creates canonical issue and pull ids', () => {
    expect(workItemIdFromIssue(42)).toBe('42')
    expect(workItemIdFromPull(42)).toBe('pr-42')
  })

  it('parses valid issue ids', () => {
    expect(parseWorkItemId('1')).toEqual({ type: 'issue', number: 1 })
    expect(parseWorkItemId('42')).toEqual({ type: 'issue', number: 42 })
  })

  it('parses valid pull ids', () => {
    expect(parseWorkItemId('pr-1')).toEqual({ type: 'pull', number: 1 })
    expect(parseWorkItemId('pr-42')).toEqual({ type: 'pull', number: 42 })
  })

  it('rejects non-positive, non-integer and malformed issue ids', () => {
    expect(() => parseWorkItemId('0')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('-2')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('1.5')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('abc')).toThrow('Invalid work item id')
  })

  it('rejects non-positive, non-integer and malformed pull ids', () => {
    expect(() => parseWorkItemId('pr-0')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('pr--2')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('pr-1.5')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('pr-abc')).toThrow('Invalid work item id')
    expect(() => parseWorkItemId('pr-')).toThrow('Invalid work item id')
  })
})
