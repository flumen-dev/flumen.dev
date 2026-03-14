/**
 * Returns the shared GitHub PAT for fetching public/shared repository data.
 * Returns null if no PAT is configured, causing the shared data layer
 * to fall back to the requesting user's OAuth token.
 */
export function getSharedToken(): string | null {
  const { githubToken } = useRuntimeConfig() as { githubToken?: string }
  return githubToken || null
}
