import { describe, expect, it } from 'vitest'
import { mapContextNode } from '../../server/utils/check-run-mapper'
import type { CheckRunNode, StatusContextNode } from '../../server/utils/check-run-mapper'

function makeCheckRun(overrides: Partial<CheckRunNode> = {}): CheckRunNode {
  return {
    __typename: 'CheckRun',
    databaseId: 123,
    name: 'CI',
    conclusion: null,
    status: 'IN_PROGRESS',
    startedAt: null,
    completedAt: null,
    detailsUrl: null,
    ...overrides,
  }
}

function makeStatusContext(overrides: Partial<StatusContextNode> = {}): StatusContextNode {
  return {
    __typename: 'StatusContext',
    context: 'ci/test',
    state: 'PENDING',
    targetUrl: null,
    createdAt: null,
    ...overrides,
  }
}

describe('mapContextNode — CheckRun', () => {
  it('maps SUCCESS conclusion', () => {
    const result = mapContextNode(makeCheckRun({ conclusion: 'SUCCESS' }))
    expect(result.status).toBe('SUCCESS')
    expect(result.name).toBe('CI')
    expect(result.jobId).toBe(123)
  })

  it('maps FAILURE conclusion', () => {
    const result = mapContextNode(makeCheckRun({ conclusion: 'FAILURE' }))
    expect(result.status).toBe('FAILURE')
  })

  it('maps IN_PROGRESS status to PENDING when no conclusion', () => {
    const result = mapContextNode(makeCheckRun({ status: 'IN_PROGRESS', conclusion: null }))
    expect(result.status).toBe('PENDING')
  })

  it('maps QUEUED status to PENDING', () => {
    const result = mapContextNode(makeCheckRun({ status: 'QUEUED', conclusion: null }))
    expect(result.status).toBe('PENDING')
  })

  it('maps COMPLETED without conclusion to FAILURE (safety fallback)', () => {
    const result = mapContextNode(makeCheckRun({ status: 'COMPLETED', conclusion: null }))
    expect(result.status).toBe('FAILURE')
  })

  it('calculates duration from timestamps', () => {
    const result = mapContextNode(makeCheckRun({
      conclusion: 'SUCCESS',
      startedAt: '2026-02-28T10:00:00Z',
      completedAt: '2026-02-28T10:02:35Z',
    }))
    expect(result.durationSeconds).toBe(155)
  })

  it('returns null duration when timestamps missing', () => {
    const result = mapContextNode(makeCheckRun({ conclusion: 'SUCCESS' }))
    expect(result.durationSeconds).toBeNull()
  })

  it('preserves detailsUrl and jobId', () => {
    const result = mapContextNode(makeCheckRun({
      conclusion: 'SUCCESS',
      detailsUrl: 'https://github.com/run/123',
      databaseId: 456,
    }))
    expect(result.detailsUrl).toBe('https://github.com/run/123')
    expect(result.jobId).toBe(456)
  })
})

describe('mapContextNode — StatusContext', () => {
  it('maps SUCCESS state', () => {
    const result = mapContextNode(makeStatusContext({ state: 'SUCCESS' }))
    expect(result.status).toBe('SUCCESS')
    expect(result.name).toBe('ci/test')
  })

  it('maps ERROR to FAILURE', () => {
    const result = mapContextNode(makeStatusContext({ state: 'ERROR' }))
    expect(result.status).toBe('FAILURE')
  })

  it('maps EXPECTED to PENDING', () => {
    const result = mapContextNode(makeStatusContext({ state: 'EXPECTED' }))
    expect(result.status).toBe('PENDING')
  })

  it('maps unknown state to null', () => {
    const result = mapContextNode(makeStatusContext({ state: 'SOMETHING_WEIRD' }))
    expect(result.status).toBeNull()
  })

  it('always has null jobId and durationSeconds', () => {
    const result = mapContextNode(makeStatusContext({ state: 'SUCCESS' }))
    expect(result.jobId).toBeNull()
    expect(result.durationSeconds).toBeNull()
  })

  it('preserves targetUrl as detailsUrl', () => {
    const result = mapContextNode(makeStatusContext({
      state: 'SUCCESS',
      targetUrl: 'https://example.com',
    }))
    expect(result.detailsUrl).toBe('https://example.com')
  })
})
