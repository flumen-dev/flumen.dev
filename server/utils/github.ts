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

// --- Token extraction helper ---

export async function getSessionToken(event: H3Event): Promise<{ token: string, userId: number, login: string }> {
  const session = await requireUserSession(event)
  const token = session.secure?.accessToken
  if (!token) {
    throw new GitHubError(401, '', 'No GitHub access token in session')
  }
  return { token, userId: session.user!.id as number, login: session.user!.login }
}

export function getRepoParams(event: H3Event): { owner: string, repo: string } {
  const { owner, repo } = getRouterParams(event)
  if (!owner || !repo) {
    throw createError({ statusCode: 400, message: 'Missing owner or repo parameter' })
  }
  return { owner, repo }
}

// --- Token-based core functions (usable inside defineCachedFunction) ---

export async function githubFetchWithToken<T>(
  token: string,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T>> {
  const url = buildUrl(endpoint, options.params)

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: buildHeaders(token),
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new GitHubError(response.status, endpoint, `GitHub API ${response.status}: ${response.statusText}`)
  }

  const data = await response.json() as T
  return { data, status: response.status, headers: response.headers }
}

export async function githubFetchAllWithToken<T>(
  token: string,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T[]>> {
  const params = { per_page: 100, ...options.params }
  const firstUrl = buildUrl(endpoint, params)

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

export async function githubCachedFetchWithToken<T>(
  token: string,
  userId: number,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T>> {
  const url = buildUrl(endpoint, options.params)

  const storage = useStorage('data')
  const cacheKey = buildCacheKey(userId, endpoint, options.params)
  const cached = await storage.getItem<CacheEntry<T>>(cacheKey)

  const headers: Record<string, string> = buildHeaders(token)
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

export async function githubCachedFetchAllWithToken<T>(
  token: string,
  userId: number,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T[]>> {
  const params = { per_page: 100, ...options.params }
  const firstUrl = buildUrl(endpoint, params)

  const storage = useStorage('data')
  const cacheKey = buildCacheKey(userId, endpoint, params)
  const cached = await storage.getItem<CacheEntry<T[]>>(cacheKey)

  const headers: Record<string, string> = buildHeaders(token)
  if (cached?.etag && cached.pageCount === 1) {
    headers['If-None-Match'] = cached.etag
  }

  const firstResponse = await fetch(firstUrl, { method: 'GET', headers })

  if (firstResponse.status === 304 && cached) {
    return { data: cached.data, status: 304, headers: firstResponse.headers }
  }

  if (!firstResponse.ok) {
    throw new GitHubError(firstResponse.status, endpoint, `GitHub API ${firstResponse.status}: ${firstResponse.statusText}`)
  }

  const items = await firstResponse.json() as T[]
  const etag = firstResponse.headers.get('etag')

  const remainingPages = parseRemainingPages(firstResponse.headers.get('link'))
  const pageCount = 1 + remainingPages.length

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
    await storage.setItem(cacheKey, { etag, data: items, pageCount } satisfies CacheEntry<T[]>)
  }

  return { data: items, status: 200, headers: firstResponse.headers }
}

// --- Event-based wrappers (convenience for simple endpoints) ---

export async function githubFetch<T>(
  event: H3Event,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T>> {
  const { token } = await getSessionToken(event)
  return githubFetchWithToken<T>(token, endpoint, options)
}

export async function githubFetchAll<T>(
  event: H3Event,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T[]>> {
  const { token } = await getSessionToken(event)
  return githubFetchAllWithToken<T>(token, endpoint, options)
}

export async function githubCachedFetch<T>(
  event: H3Event,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T>> {
  const { token, userId } = await getSessionToken(event)
  return githubCachedFetchWithToken<T>(token, userId, endpoint, options)
}

export async function githubCachedFetchAll<T>(
  event: H3Event,
  endpoint: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T[]>> {
  const { token, userId } = await getSessionToken(event)
  return githubCachedFetchAllWithToken<T>(token, userId, endpoint, options)
}

// --- Search helper ---

/**
 * Counts search results grouped by repository.
 * Used for issue/PR counts across all user repos.
 */
export async function githubSearchCounts(
  token: string,
  query: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  let page = 1

  while (true) {
    const { data } = await githubFetchWithToken<SearchResponse>(
      token,
      '/search/issues',
      { params: { q: query, per_page: 100, page } },
    )

    for (const item of data.items) {
      const fullName = item.repository_url.replace('https://api.github.com/repos/', '')
      counts[fullName] = (counts[fullName] || 0) + 1
    }

    if (data.items.length < 100) break
    page++
    if (page > 10) break
  }

  return counts
}

// --- Internal helpers ---

interface CacheEntry<T> {
  etag: string
  data: T
  pageCount?: number
}

function buildUrl(endpoint: string, params?: Record<string, string | number>): URL {
  const url = new URL(endpoint, GITHUB_API)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value))
    }
  }
  return url
}

function buildCacheKey(
  userId: number,
  endpoint: string,
  params?: Record<string, string | number>,
): string {
  const endpointKey = endpoint.replaceAll('/', '~')
  const paramStr = params
    ? ':' + Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&')
    : ''
  return `github-cache:${userId}:${endpointKey}${paramStr}`
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
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
