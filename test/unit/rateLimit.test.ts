import { describe, expect, it } from 'vitest'
import { getRateLimit, updateRateLimitFromHeaders } from '../../server/utils/github'

function fakeHeaders(limit: number, remaining: number, reset: number): Headers {
  const h = new Headers()
  h.set('x-ratelimit-limit', String(limit))
  h.set('x-ratelimit-remaining', String(remaining))
  h.set('x-ratelimit-reset', String(reset))
  return h
}

const USER_A = 1001
const USER_B = 1002

describe('rate limit tracking', () => {
  it('aggregates REST and GraphQL limits per user', () => {
    updateRateLimitFromHeaders(fakeHeaders(5000, 4900, 1000), 'rest', USER_A)
    updateRateLimitFromHeaders(fakeHeaders(5000, 4800, 1100), 'graphql', USER_A)

    const info = getRateLimit(USER_A)
    expect(info.limit).toBe(10000)
    expect(info.remaining).toBe(9700)
    expect(info.reset).toBe(1100)
  })

  it('isolates rate limits between users', () => {
    updateRateLimitFromHeaders(fakeHeaders(5000, 100, 2000), 'rest', USER_B)
    updateRateLimitFromHeaders(fakeHeaders(5000, 200, 2000), 'graphql', USER_B)

    const infoA = getRateLimit(USER_A)
    const infoB = getRateLimit(USER_B)

    expect(infoA.remaining).toBe(9700) // from previous test
    expect(infoB.remaining).toBe(300)
  })

  it('returns zeroes for unknown user', () => {
    const info = getRateLimit(9999)
    expect(info.limit).toBe(0)
    expect(info.remaining).toBe(0)
  })

  it('ignores headers without userId', () => {
    updateRateLimitFromHeaders(fakeHeaders(5000, 0, 3000), 'rest')
    // Should not affect any user
    const info = getRateLimit(USER_A)
    expect(info.remaining).toBe(9700)
  })
})
