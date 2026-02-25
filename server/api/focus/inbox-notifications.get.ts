/**
 * Lightweight notification check endpoint.
 * Uses GitHub's Notifications API with If-Modified-Since header
 * so 304 responses are free (don't count against rate limit).
 *
 * Returns { count, lastModified } or { count: 0 } if nothing new.
 */
export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)

  const query = getQuery(event)
  const since = (query.since as string) || ''
  const repo = (query.repo as string) || '' // "owner/repo" format
  const lastModified = (query.lastModified as string) || ''

  if (!since) {
    throw createError({ statusCode: 400, statusMessage: 'Missing "since" parameter' })
  }

  // Build URL: repo-specific or general notifications
  const baseUrl = repo
    ? `https://api.github.com/repos/${repo}/notifications`
    : 'https://api.github.com/notifications'

  const url = `${baseUrl}?since=${encodeURIComponent(since)}&all=false&participating=false`

  const headers: Record<string, string> = {
    Authorization: `bearer ${token}`,
    Accept: 'application/vnd.github+json',
  }

  if (lastModified) {
    headers['If-Modified-Since'] = lastModified
  }

  const response = await fetch(url, { headers })

  // 304 = nothing new, free call
  if (response.status === 304) {
    return { count: 0, modified: false }
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `GitHub Notifications: ${response.statusText}`,
    })
  }

  const notifications = await response.json() as Array<{
    id: string
    reason: string
    subject: { type: string }
    repository: { full_name: string }
    updated_at: string
  }>

  // Only count PR and Issue notifications
  const relevant = notifications.filter(n =>
    n.subject.type === 'PullRequest' || n.subject.type === 'Issue',
  )

  return {
    count: relevant.length,
    modified: true,
    lastModified: response.headers.get('Last-Modified') || '',
  }
})
