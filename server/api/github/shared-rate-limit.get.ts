export default defineEventHandler(async (event) => {
  // Keep this endpoint session-protected like the user rate-limit endpoint.
  await getSessionToken(event)

  const sharedToken = getSharedToken()
  if (!sharedToken) {
    return { limit: 0, remaining: 0, reset: 0, configured: false }
  }

  const info = getSharedRateLimit()

  // Seed cache if nothing tracked yet.
  if (info.limit === 0) {
    const { data } = await githubFetchWithToken<{
      resources: {
        core: { limit: number, remaining: number, reset: number }
        graphql: { limit: number, remaining: number, reset: number }
      }
    }>(sharedToken, '/rate_limit')

    const core = data.resources.core
    const graphql = data.resources.graphql
    updateRateLimitFromHeaders(new Headers({
      'x-ratelimit-limit': String(core.limit),
      'x-ratelimit-remaining': String(core.remaining),
      'x-ratelimit-reset': String(core.reset),
    }), 'rest', undefined, true)
    updateRateLimitFromHeaders(new Headers({
      'x-ratelimit-limit': String(graphql.limit),
      'x-ratelimit-remaining': String(graphql.remaining),
      'x-ratelimit-reset': String(graphql.reset),
    }), 'graphql', undefined, true)

    return {
      ...getSharedRateLimit(),
      configured: true,
    }
  }

  return {
    ...info,
    configured: true,
  }
})
