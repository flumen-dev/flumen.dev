import type { H3Event } from 'h3'
import { getSharedToken } from './github-app'

// --- In-memory rate limit cache (updated from every GitHub response) ---
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

const rateLimitsPerUser = new Map<number, Record<string, RateLimitInfo>>()
const rateLimitsShared: Record<string, RateLimitInfo> = {}

export function getRateLimit(userId: number): RateLimitInfo {
  const rateLimits = rateLimitsPerUser.get(userId)
  if (!rateLimits) return { limit: 0, remaining: 0, reset: 0 }
  const entries = Object.values(rateLimits)
  if (!entries.length) return { limit: 0, remaining: 0, reset: 0 }
  return {
    limit: entries.reduce((s, e) => s + e.limit, 0),
    remaining: entries.reduce((s, e) => s + e.remaining, 0),
    reset: Math.max(...entries.map(e => e.reset)),
  }
}

export function getSharedRateLimit(): RateLimitInfo {
  const entries = Object.values(rateLimitsShared)
  if (!entries.length) return { limit: 0, remaining: 0, reset: 0 }
  return {
    limit: entries.reduce((s, e) => s + e.limit, 0),
    remaining: entries.reduce((s, e) => s + e.remaining, 0),
    reset: Math.max(...entries.map(e => e.reset)),
  }
}

export function updateRateLimitFromHeaders(
  headers: Headers,
  source: 'rest' | 'graphql' = 'rest',
  userId?: number,
  trackShared: boolean = false,
) {
  const limit = Number(headers.get('x-ratelimit-limit'))
  const remaining = Number(headers.get('x-ratelimit-remaining'))
  const reset = Number(headers.get('x-ratelimit-reset'))
  if (limit > 0 && userId != null) {
    if (!rateLimitsPerUser.has(userId)) rateLimitsPerUser.set(userId, {})
    rateLimitsPerUser.get(userId)![source] = { limit, remaining, reset }
  }
  if (limit > 0 && trackShared) {
    rateLimitsShared[source] = { limit, remaining, reset }
  }
}

function isSharedToken(token: string): boolean {
  const sharedToken = getSharedToken()
  return Boolean(sharedToken) && token === sharedToken
}

const GITHUB_API = 'https://api.github.com'
const GITHUB_FETCH_MAX_ATTEMPTS = 4
const GITHUB_FETCH_BASE_RETRY_DELAY_MS = 400

export interface GitHubRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number>
  userId?: number
  onPageFetched?: (info: { page: number, pageItems: number, totalItems: number }) => void
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

const GITHUB_LOGIN_PATTERN = /^(?!.*--)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/

export function getOrgQuery(event: H3Event): string | undefined {
  const org = getQuery(event).org as string | undefined
  if (org && !GITHUB_LOGIN_PATTERN.test(org)) {
    throw createError({ statusCode: 400, message: 'Invalid org parameter' })
  }
  return org
}

export function getLoginQuery(event: H3Event): string {
  const login = (getQuery(event).login as string | undefined)?.trim()
  if (!login || !GITHUB_LOGIN_PATTERN.test(login)) {
    throw createError({ statusCode: 400, message: 'Invalid login parameter' })
  }
  return login
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
    const errorBody = await response.json().catch(() => null) as { message?: string, errors?: { message?: string }[] } | null
    const detail = errorBody?.errors?.[0]?.message ?? errorBody?.message ?? response.statusText
    throw new GitHubError(response.status, endpoint, detail)
  }

  updateRateLimitFromHeaders(response.headers, 'rest', options.userId, isSharedToken(token))

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
  updateRateLimitFromHeaders(firstResponse.headers, 'rest', options.userId, isSharedToken(token))
  const items = await firstResponse.json() as T[]
  let page = 1
  options.onPageFetched?.({ page, pageItems: items.length, totalItems: items.length })

  let nextPageUrl = parseNextPageUrl(firstResponse.headers.get('link'))
  while (nextPageUrl) {
    const res = await fetchGitHub(nextPageUrl, headers, endpoint)
    updateRateLimitFromHeaders(res.headers, 'rest', options.userId, isSharedToken(token))
    const pageItems = await res.json() as T[]
    items.push(...pageItems)
    page += 1
    options.onPageFetched?.({ page, pageItems: pageItems.length, totalItems: items.length })
    nextPageUrl = parseNextPageUrl(res.headers.get('link'))
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

  updateRateLimitFromHeaders(response.headers, 'rest', userId, isSharedToken(token))

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
  updateRateLimitFromHeaders(firstResponse.headers, 'rest', userId, isSharedToken(token))

  if (firstResponse.status === 304 && cached) {
    return { data: cached.data, status: 304, headers: firstResponse.headers }
  }

  if (!firstResponse.ok) {
    throw new GitHubError(firstResponse.status, endpoint, `GitHub API ${firstResponse.status}: ${firstResponse.statusText}`)
  }

  const items = await firstResponse.json() as T[]
  const etag = firstResponse.headers.get('etag')

  const fetchHeaders = buildHeaders(token)
  let pageCount = 1
  let nextPageUrl = parseNextPageUrl(firstResponse.headers.get('link'))

  while (nextPageUrl) {
    const res = await fetchGitHub(nextPageUrl, fetchHeaders, endpoint)
    updateRateLimitFromHeaders(res.headers, 'rest', userId, isSharedToken(token))
    const pageItems = await res.json() as T[]
    items.push(...pageItems)
    pageCount += 1
    nextPageUrl = parseNextPageUrl(res.headers.get('link'))
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
  for (let attempt = 1; attempt <= GITHUB_FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'GET', headers })
      if (response.ok) return response

      if (shouldRetryStatus(response.status) && attempt < GITHUB_FETCH_MAX_ATTEMPTS) {
        const delayMs = getRetryDelayMs(attempt, response.headers)
        console.warn('[github] transient non-ok response, retrying', {
          endpoint,
          status: response.status,
          attempt,
          maxAttempts: GITHUB_FETCH_MAX_ATTEMPTS,
          retryDelayMs: delayMs,
        })
        await sleep(delayMs)
        continue
      }

      throw new GitHubError(response.status, endpoint, `GitHub API ${response.status}: ${response.statusText}`)
    }
    catch (error) {
      if (shouldRetryFetchError(error) && attempt < GITHUB_FETCH_MAX_ATTEMPTS) {
        const delayMs = getRetryDelayMs(attempt)
        console.warn('[github] transient fetch error, retrying', {
          endpoint,
          attempt,
          maxAttempts: GITHUB_FETCH_MAX_ATTEMPTS,
          retryDelayMs: delayMs,
          error: error instanceof Error ? error.message : String(error),
        })
        await sleep(delayMs)
        continue
      }
      throw error
    }
  }

  throw new GitHubError(500, endpoint, 'GitHub request failed after retries')
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function shouldRetryFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const code = (error as { cause?: { code?: string } })?.cause?.code
  if (typeof code === 'string') {
    if (
      code === 'UND_ERR_SOCKET'
      || code === 'UND_ERR_CONNECT_TIMEOUT'
      || code === 'UND_ERR_HEADERS_TIMEOUT'
      || code === 'UND_ERR_BODY_TIMEOUT'
      || code === 'ECONNRESET'
      || code === 'ETIMEDOUT'
      || code === 'EAI_AGAIN'
    ) {
      return true
    }
  }

  // Fallback for wrapped undici errors where only message is preserved.
  return /fetch failed|socket|timeout/i.test(error.message)
}

function getRetryDelayMs(attempt: number, headers?: Headers): number {
  const retryAfter = headers?.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 10_000)
    }
  }

  const exponential = GITHUB_FETCH_BASE_RETRY_DELAY_MS * (2 ** Math.max(0, attempt - 1))
  const jitter = Math.floor(Math.random() * 150)
  return Math.min(exponential + jitter, 5_000)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseNextPageUrl(header: string | null): string | null {
  if (!header) return null
  const nextMatch = header.match(/<([^>]+)>;\s*rel="next"/)
  return nextMatch?.[1] ?? null
}
