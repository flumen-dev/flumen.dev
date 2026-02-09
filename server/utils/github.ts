import type { H3Event } from 'h3'

const GITHUB_API = 'https://api.github.com'

export interface GitHubRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number>
}

export interface GitHubResponse<T> {
  data: T
  status: number
  headers: Headers
}

export class GitHubError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(message)
    this.name = 'GitHubError'
  }
}

/**
 * Authenticated GitHub API fetch. Pulls the token from the user session.
 */
export async function githubFetch<T>(
  event: H3Event,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T>> {
  const session = await requireUserSession(event)
  const token = session.secure?.accessToken

  if (!token) {
    throw new GitHubError(401, endpoint, 'No GitHub access token in session')
  }

  const url = new URL(endpoint, GITHUB_API)

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new GitHubError(
      response.status,
      endpoint,
      `GitHub API ${response.status}: ${response.statusText}`,
    )
  }

  const data = await response.json() as T

  return { data, status: response.status, headers: response.headers }
}

/**
 * Fetches all pages of a paginated GitHub API endpoint.
 * Page 1 first, then remaining pages in parallel via rel="last".
 */
export async function githubFetchAll<T>(
  event: H3Event,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T[]>> {
  const session = await requireUserSession(event)
  const token = session.secure?.accessToken

  if (!token) {
    throw new GitHubError(401, endpoint, 'No GitHub access token in session')
  }

  const params = { per_page: 100, ...options.params }
  const firstUrl = new URL(endpoint, GITHUB_API)
  for (const [key, value] of Object.entries(params)) {
    firstUrl.searchParams.set(key, String(value))
  }

  const headers = buildHeaders(token)
  const firstResponse = await fetchGitHub(firstUrl, headers, endpoint)
  const items = await firstResponse.json() as T[]

  const remainingPages = parseRemainingPages(firstResponse.headers.get('link'))
  if (remainingPages.length) {
    const pages = await Promise.all(
      remainingPages.map(async (pageUrl) => {
        const res = await fetchGitHub(pageUrl, headers, endpoint)
        return res.json() as Promise<T[]>
      }),
    )
    for (const page of pages) items.push(...page)
  }

  return { data: items, status: 200, headers: firstResponse.headers }
}

/**
 * Like githubFetch, but with ETag caching via KV storage.
 * Returns cached data on 304 (0 rate limit cost).
 */
export async function githubCachedFetch<T>(
  event: H3Event,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T>> {
  const session = await requireUserSession(event)
  const token = session.secure?.accessToken
  const userId = session.user?.id

  if (!token) {
    throw new GitHubError(401, endpoint, 'No GitHub access token in session')
  }

  const url = new URL(endpoint, GITHUB_API)
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, String(value))
    }
  }

  const storage = useStorage('data')
  const cacheKey = buildCacheKey(userId!, endpoint, options.params)
  const cached = await storage.getItem<CacheEntry<T>>(cacheKey)

  const headers: Record<string, string> = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 304 && cached) {
    return { data: cached.data, status: 304, headers: response.headers }
  }

  if (!response.ok) {
    throw new GitHubError(response.status, endpoint, `GitHub API ${response.status}: ${response.statusText}`)
  }

  const data = await response.json() as T
  const etag = response.headers.get('etag')

  if (etag) {
    await storage.setItem(cacheKey, { etag, data } satisfies CacheEntry<T>)
  }

  return { data, status: response.status, headers: response.headers }
}

/**
 * Like githubFetchAll, but with ETag caching.
 * Sends conditional request for page 1 — if 304, returns full cached set.
 * If 200, re-fetches all pages and updates cache.
 */
export async function githubCachedFetchAll<T>(
  event: H3Event,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T[]>> {
  const session = await requireUserSession(event)
  const token = session.secure?.accessToken
  const userId = session.user?.id

  if (!token) {
    throw new GitHubError(401, endpoint, 'No GitHub access token in session')
  }

  const params = { per_page: 100, ...options.params }
  const firstUrl = new URL(endpoint, GITHUB_API)
  for (const [key, value] of Object.entries(params)) {
    firstUrl.searchParams.set(key, String(value))
  }

  const storage = useStorage('data')
  const cacheKey = buildCacheKey(userId!, endpoint, params)
  const cached = await storage.getItem<CacheEntry<T[]>>(cacheKey)

  const headers: Record<string, string> = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag
  }

  // Conditional request on first page
  const firstResponse = await fetch(firstUrl, { method: 'GET', headers })

  if (firstResponse.status === 304 && cached) {
    return { data: cached.data, status: 304, headers: firstResponse.headers }
  }

  if (!firstResponse.ok) {
    throw new GitHubError(firstResponse.status, endpoint, `GitHub API ${firstResponse.status}: ${firstResponse.statusText}`)
  }

  // First page changed — fetch remaining pages in parallel
  const items = await firstResponse.json() as T[]
  const etag = firstResponse.headers.get('etag')

  const remainingPages = parseRemainingPages(firstResponse.headers.get('link'))
  if (remainingPages.length) {
    const fetchHeaders = buildHeaders(token)
    const pages = await Promise.all(
      remainingPages.map(async (pageUrl) => {
        const res = await fetchGitHub(pageUrl, fetchHeaders, endpoint)
        return res.json() as Promise<T[]>
      }),
    )
    for (const page of pages) items.push(...page)
  }

  if (etag) {
    await storage.setItem(cacheKey, { etag, data: items } satisfies CacheEntry<T[]>)
  }

  return { data: items, status: 200, headers: firstResponse.headers }
}

// --- Internal helpers ---

interface CacheEntry<T> {
  etag: string
  data: T
}

function buildCacheKey(
  userId: number,
  endpoint: string,
  params?: Record<string, string | number>,
): string {
  const paramStr = params
    ? ':' + Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&')
    : ''
  return `github-cache:${userId}:${endpoint}${paramStr}`
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function fetchGitHub(url: URL | string, headers: Record<string, string>, endpoint: string): Promise<Response> {
  const response = await fetch(url, { method: 'GET', headers })
  if (!response.ok) {
    throw new GitHubError(response.status, endpoint, `GitHub API ${response.status}: ${response.statusText}`)
  }
  return response
}

/**
 * Parses Link header to get URLs for pages 2..last.
 * Returns empty array if single page.
 */
function parseRemainingPages(header: string | null): string[] {
  if (!header) return []
  const lastMatch = header.match(/<([^>]+)>;\s*rel="last"/)
  if (!lastMatch?.[1]) return []

  const lastUrl = new URL(lastMatch[1])
  const lastPage = Number(lastUrl.searchParams.get('page'))
  if (!lastPage || lastPage <= 1) return []

  const pages: string[] = []
  for (let page = 2; page <= lastPage; page++) {
    const url = new URL(lastUrl)
    url.searchParams.set('page', String(page))
    pages.push(url.toString())
  }
  return pages
}
