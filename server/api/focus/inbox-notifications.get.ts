const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FETCH_TIMEOUT_MS = 8000

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

  if (repo && !REPO_RE.test(repo)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid repo format' })
  }

  // Build URL safely using URL + URLSearchParams
  const base = repo
    ? `https://api.github.com/repos/${repo}/notifications`
    : 'https://api.github.com/notifications'

  const urlObj = new URL(base)
  urlObj.searchParams.set('since', since)
  urlObj.searchParams.set('all', 'false')
  urlObj.searchParams.set('participating', 'false')

  const headers: Record<string, string> = {
    Authorization: `bearer ${token}`,
    Accept: 'application/vnd.github+json',
  }

  if (lastModified) {
    headers['If-Modified-Since'] = lastModified
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(urlObj.toString(), { headers, signal: controller.signal })
  }
  catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw createError({ statusCode: 504, statusMessage: 'GitHub Notifications request timed out' })
    }
    throw err
  }
  finally {
    clearTimeout(timer)
  }

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
