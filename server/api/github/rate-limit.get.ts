export default defineEventHandler(async (event) => {
  const { token, userId } = await getSessionToken(event)

  const info = getRateLimit(userId)

  // Seed cache on first call (both REST + GraphQL not yet tracked)
  if (info.limit === 0 || info.limit <= 5000) {
    const { data } = await githubFetchWithToken<{
      resources: {
        core: { limit: number, remaining: number, reset: number }
        graphql: { limit: number, remaining: number, reset: number }
      }
    }>(token, '/rate_limit')

    const core = data.resources.core
    const graphql = data.resources.graphql
    updateRateLimitFromHeaders(new Headers({
      'x-ratelimit-limit': String(core.limit),
      'x-ratelimit-remaining': String(core.remaining),
      'x-ratelimit-reset': String(core.reset),
    }), 'rest', userId)
    updateRateLimitFromHeaders(new Headers({
      'x-ratelimit-limit': String(graphql.limit),
      'x-ratelimit-remaining': String(graphql.remaining),
      'x-ratelimit-reset': String(graphql.reset),
    }), 'graphql', userId)

    return getRateLimit(userId)
  }

  return info
})
