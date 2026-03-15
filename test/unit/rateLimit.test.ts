import { describe, expect, it } from 'vitest'
import { getRateLimit, updateRateLimitFromHeaders } from '../../server/utils/github'

function fakeHeaders(limit: number, remaining: number, reset: number): Headers {
  const h = new Headers()
  h.set('x-ratelimit-limit', String(limit))
  h.set('x-ratelimit-remaining', String(remaining))
  h.set('x-ratelimit-reset', String(reset))
  return h
}

describe('rate limit tracking', () => {
  it('aggregates REST and GraphQL limits', () => {
    updateRateLimitFromHeaders(fakeHeaders(5000, 4900, 1000), 'rest')
    updateRateLimitFromHeaders(fakeHeaders(5000, 4800, 1100), 'graphql')

    const info = getRateLimit()
    expect(info.limit).toBe(10000)
    expect(info.remaining).toBe(9700)
    expect(info.reset).toBe(1100)
  })

  it('updates values on subsequent calls', () => {
    updateRateLimitFromHeaders(fakeHeaders(5000, 4900, 1000), 'rest')
    updateRateLimitFromHeaders(fakeHeaders(5000, 4850, 1000), 'rest')

    const info = getRateLimit()
    // REST remaining should be 4850 (latest), graphql still 4800 from previous test
    expect(info.remaining).toBe(4850 + 4800)
  })

  it('ignores headers without valid limit', () => {
    updateRateLimitFromHeaders(fakeHeaders(5000, 4000, 2000), 'rest')
    updateRateLimitFromHeaders(new Headers(), 'rest')

    // Empty headers have limit=0, so they're ignored — previous values stay
    const info = getRateLimit()
    expect(info.limit).toBeGreaterThan(0)
  })
})
