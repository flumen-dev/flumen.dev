/**
 * Returns the shared GitHub PAT for fetching public/shared repository data.
 * Returns null if no PAT is configured, causing the shared data layer
 * to fall back to the requesting user's OAuth token.
 */
export function getSharedToken(): string | null {
  const { githubToken } = useRuntimeConfig()
  const runtimeToken = typeof githubToken === 'string' ? githubToken.trim() : ''
  if (runtimeToken) {
    return runtimeToken
  }

  // Fallbacks help on hosts where runtimeConfig mapping differs by preset.
  const fallback = process.env.NUXT_GITHUB_TOKEN
    ?? process.env.GITHUB_TOKEN
    ?? process.env.NITRO_GITHUB_TOKEN
  const fallbackToken = typeof fallback === 'string' ? fallback.trim() : ''
  return fallbackToken || null
}
