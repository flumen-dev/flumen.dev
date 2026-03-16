import type { WorkItem } from '~~/shared/types/work-item'
import type { PaginatedResponse } from '~~/shared/types/pagination'
import type { GitHubIssue, GitHubPullRequest, RepoIssue, RepoPullRequest } from '~~/shared/types/repository'
import { getSessionToken, githubFetchWithToken } from '~~/server/utils/github'
import { githubGraphQL } from '~~/server/utils/github-graphql'
import { mapCiStatus } from '~~/server/utils/focus-created'
import { toRepoIssue, toRepoPullRequest } from '~~/shared/utils/repository'

const ISSUE_LINK_REGEX = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:#|(?:[\w.-]+\/)?[\w.-]+#)(\d+)/gi

function collectIssueLinksFromText(text: string | null | undefined): number[] {
  if (!text) return []
  const links: number[] = []
  for (const match of text.matchAll(ISSUE_LINK_REGEX)) {
    const number = Number(match[1])
    if (number && !Number.isNaN(number)) {
      links.push(number)
    }
  }
  return links
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function fetchPullInsights(
  token: string,
  owner: string,
  repo: string,
  pullNumbers: number[],
): Promise<Map<number, { reviewDecision: WorkItem['reviewDecision'], ciStatus: WorkItem['ciStatus'] }>> {
  const result = new Map<number, { reviewDecision: WorkItem['reviewDecision'], ciStatus: WorkItem['ciStatus'] }>()
  if (!pullNumbers.length) return result

  for (const batch of chunk(pullNumbers, 40)) {
    const fields = batch
      .map((number, index) => `
        pr${index}: pullRequest(number: ${number}) {
          number
          reviewDecision
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup { state }
              }
            }
          }
        }
      `)
      .join('\n')

    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          ${fields}
        }
      }
    `

    try {
      const data = await githubGraphQL<Record<string, Record<string, {
        number: number
        reviewDecision: WorkItem['reviewDecision']
        commits?: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> }
      } | null>>>(token, query, { owner, repo })

      const repository = data.repository ?? {}
      Object.values(repository).forEach((pull) => {
        if (!pull) return
        const ciRaw = pull.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
        result.set(pull.number, {
          reviewDecision: pull.reviewDecision ?? null,
          ciStatus: mapCiStatus(ciRaw),
        })
      })

      for (const pullNumber of batch) {
        if (!result.has(pullNumber)) {
          result.set(pullNumber, { reviewDecision: null, ciStatus: null })
        }
      }
    }
    catch (error) {
      console.error('[work-items] Failed to fetch pull insights batch', { owner, repo, batch, error })
      for (const pullNumber of batch) {
        if (!result.has(pullNumber)) {
          result.set(pullNumber, { reviewDecision: null, ciStatus: null })
        }
      }
    }
  }

  return result
}

function buildWorkItems(
  issues: RepoIssue[],
  pulls: RepoPullRequest[],
  rawPulls: Array<{ number: number, body?: string | null }>,
  pullInsights: Map<number, { reviewDecision: WorkItem['reviewDecision'], ciStatus: WorkItem['ciStatus'] }>,
  owner: string,
  repo: string,
): WorkItem[] {
  const issueMap = new Map<number, RepoIssue>(issues.map(issue => [issue.number, issue]))
  const pullMap = new Map<number, RepoPullRequest>(pulls.map(pr => [pr.number, pr]))
  const linkedPullsByIssue = new Map<number, RepoPullRequest[]>()
  const linkedIssueNumbersByPull = new Map<number, number[]>()

  for (const pull of rawPulls) {
    const linkedIssueNumbers = Array.from(new Set(collectIssueLinksFromText(pull.body)))
    linkedIssueNumbersByPull.set(pull.number, linkedIssueNumbers)
    const mappedPull = pullMap.get(pull.number)
    if (!mappedPull) continue

    for (const issueNumber of linkedIssueNumbers) {
      if (!issueMap.has(issueNumber)) continue
      const current = linkedPullsByIssue.get(issueNumber) ?? []
      linkedPullsByIssue.set(issueNumber, [...current, mappedPull])
    }
  }

  const issueWorkItems: WorkItem[] = issues.map((issue) => {
    const linkedPulls = linkedPullsByIssue.get(issue.number) ?? []
    const primaryLinkedPull = linkedPulls[0] ?? null
    const linkedInsight = primaryLinkedPull ? pullInsights.get(primaryLinkedPull.number) : null
    return {
      id: String(issue.number),
      type: 'issue' as const,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      htmlUrl: issue.htmlUrl,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      author: issue.user,
      labels: issue.labels,
      assignees: issue.assignees,
      commentCount: issue.comments,
      isDraft: primaryLinkedPull?.draft ?? false,
      reviewDecision: linkedInsight?.reviewDecision ?? null,
      ciStatus: linkedInsight?.ciStatus ?? null,
      issue,
      pull: null,
      linkedPulls: linkedPulls.map(pr => ({
        type: 'pull' as const,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        isDraft: pr.draft,
        htmlUrl: pr.htmlUrl,
      })),
      linkedIssues: [],
    }
  })

  const standalonePullWorkItems: WorkItem[] = pulls
    .filter((pr) => {
      const linkedIssues = linkedIssueNumbersByPull.get(pr.number) ?? []
      return linkedIssues.length === 0 || linkedIssues.every(number => !issueMap.has(number))
    })
    .map((pr) => {
      const insight = pullInsights.get(pr.number)
      return {
        id: String(pr.number),
        type: 'pull' as const,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        htmlUrl: pr.htmlUrl,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        author: pr.user,
        labels: pr.labels,
        assignees: pr.assignees,
        commentCount: pr.comments,
        isDraft: pr.draft,
        reviewDecision: insight?.reviewDecision ?? null,
        ciStatus: insight?.ciStatus ?? null,
        issue: null,
        pull: pr,
        linkedPulls: [],
        linkedIssues: (linkedIssueNumbersByPull.get(pr.number) ?? []).map(number => ({
          type: 'issue' as const,
          number,
          title: issueMap.get(number)?.title ?? `#${number}`,
          state: issueMap.get(number)?.state,
          htmlUrl: issueMap.get(number)?.htmlUrl ?? `https://github.com/${owner}/${repo}/issues/${number}`,
        })),
      }
    })

  return [...issueWorkItems, ...standalonePullWorkItems]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

const fetchAllWorkItems = defineCachedFunction(
  async (login: string, token: string, owner: string, repo: string, state: 'open' | 'closed'): Promise<WorkItem[]> => {
    const [issuesResponse, pullsResponse] = await Promise.all([
      githubFetchWithToken<Array<GitHubIssue & { pull_request?: unknown }>>(
        token,
        `/repos/${owner}/${repo}/issues`,
        { params: { state, sort: 'updated', direction: 'desc', per_page: 100 } },
      ),
      githubFetchWithToken<Array<GitHubPullRequest & { body?: string }>>(
        token,
        `/repos/${owner}/${repo}/pulls`,
        { params: { state, sort: 'updated', direction: 'desc', per_page: 100 } },
      ),
    ])

    const issues = issuesResponse.data
      .filter(i => !('pull_request' in i))
      .map(i => toRepoIssue(i))

    const pulls = pullsResponse.data.map(pr => toRepoPullRequest(pr))
    const pullInsights = await fetchPullInsights(token, owner, repo, pulls.map(pr => pr.number))

    return buildWorkItems(issues, pulls, pullsResponse.data, pullInsights, owner, repo)
  },
  {
    maxAge: 120,
    name: 'work-items-paginated',
    getKey: (login: string, _token: string, owner: string, repo: string, state: 'open' | 'closed') =>
      `${login}/${owner}/${repo}:${state}`,
  },
)

// --- Search-based fetch ---

interface SearchFilters {
  q?: string
  assignee?: string
  author?: string
  label?: string
  type?: 'issue' | 'pr'
}

function hasSearchFilters(filters: SearchFilters): boolean {
  return !!(filters.q || filters.assignee || filters.author || filters.label || filters.type)
}

function buildSearchQuery(owner: string, repo: string, state: string, filters: SearchFilters): string {
  const parts = [`repo:${owner}/${repo}`]
  if (state === 'open') parts.push('is:open')
  else if (state === 'closed') parts.push('is:closed')
  if (filters.type === 'issue') parts.push('is:issue')
  else if (filters.type === 'pr') parts.push('is:pr')
  if (filters.assignee) parts.push(`assignee:${filters.assignee}`)
  if (filters.author) parts.push(`author:${filters.author}`)
  if (filters.label) parts.push(`label:"${filters.label}"`)
  if (filters.q) parts.push(filters.q)
  return parts.join(' ')
}

interface GitHubSearchResult {
  total_count: number
  items: Array<GitHubIssue & { pull_request?: { url: string } } & { body?: string }>
}

async function searchWorkItems(
  token: string,
  owner: string,
  repo: string,
  state: string,
  filters: SearchFilters,
  pageSize: number,
  page: number,
): Promise<PaginatedResponse<WorkItem>> {
  const q = buildSearchQuery(owner, repo, state, filters)

  const { data } = await githubFetchWithToken<GitHubSearchResult>(
    token, '/search/issues',
    { params: { q, sort: 'updated', order: 'desc', per_page: pageSize, page } },
  )

  // Build items + discover links from PR bodies
  const pullNumbers: number[] = []
  const issueMap = new Map<number, WorkItem>()
  const prMap = new Map<number, WorkItem>()
  const linkedIssuesByPr = new Map<number, number[]>()
  const items: WorkItem[] = []

  for (const item of data.items) {
    const isPr = !!item.pull_request
    if (isPr) {
      pullNumbers.push(item.number)
      linkedIssuesByPr.set(item.number, collectIssueLinksFromText(item.body))
    }

    const workItem: WorkItem = {
      id: String(item.number),
      type: isPr ? 'pull' : 'issue',
      number: item.number,
      title: item.title,
      state: item.state?.toUpperCase() ?? 'OPEN',
      htmlUrl: item.html_url,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      author: { login: item.user?.login ?? '', avatarUrl: item.user?.avatar_url ?? '' },
      labels: item.labels ?? [],
      assignees: (item.assignees ?? []).map(a => ({ login: a.login, avatarUrl: a.avatar_url })),
      commentCount: item.comments ?? 0,
      isDraft: isPr && 'draft' in item ? Boolean(item.draft) : false,
      reviewDecision: null,
      ciStatus: null,
      issue: null,
      pull: null,
      linkedPulls: [],
      linkedIssues: [],
    }

    items.push(workItem)
    if (isPr) prMap.set(item.number, workItem)
    else issueMap.set(item.number, workItem)
  }

  // Link issues ↔ PRs — fetch missing issues in one GraphQL call
  const allLinkedIssueNums = new Set([...linkedIssuesByPr.values()].flat())
  const missingNums = [...allLinkedIssueNums].filter(n => !issueMap.has(n)).slice(0, 20)
  const missingIssues = new Map<number, { title: string, state: string }>()

  if (missingNums.length) {
    try {
      const fragments = missingNums.map((n, i) => `i${i}:issue(number:${n}){number title state}`).join(' ')
      const gql = `query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){${fragments}}}`
      const res = await githubGraphQL<{ repository: Record<string, { number: number, title: string, state: string } | null> }>(token, gql, { owner, repo })
      for (const v of Object.values(res.repository)) {
        if (v) missingIssues.set(v.number, { title: v.title, state: v.state })
      }
    }
    catch { /* links just won't have titles */ }
  }

  for (const [prNumber, issueNumbers] of linkedIssuesByPr) {
    const pr = prMap.get(prNumber)
    if (!pr) continue
    for (const n of issueNumbers) {
      const issue = issueMap.get(n)
      const missing = missingIssues.get(n)
      const title = issue?.title ?? missing?.title ?? `#${n}`
      const state = issue?.state ?? missing?.state
      pr.linkedIssues.push({ type: 'issue', number: n, title, state, htmlUrl: issue?.htmlUrl ?? `https://github.com/${owner}/${repo}/issues/${n}` })
      if (issue) {
        issue.linkedPulls.push({ type: 'pull', number: prNumber, title: pr.title, state: pr.state, htmlUrl: pr.htmlUrl })
      }
    }
  }

  // Enrich PRs with review decision + CI status
  const pullInsights = await fetchPullInsights(token, owner, repo, pullNumbers)
  for (const item of items) {
    const insight = pullInsights.get(item.number)
    if (insight) {
      item.reviewDecision = insight.reviewDecision
      item.ciStatus = insight.ciStatus
    }
  }

  const hasNextPage = page * pageSize < data.total_count

  return {
    items,
    totalCount: data.total_count,
    pageInfo: {
      hasNextPage,
      endCursor: hasNextPage ? String(page) : null,
    },
  }
}

export default defineEventHandler(async (event): Promise<PaginatedResponse<WorkItem>> => {
  const { token, login } = await getSessionToken(event)
  const query = getQuery<{
    state?: string
    repo?: string
    first?: string
    after?: string
    q?: string
    assignee?: string
    author?: string
    label?: string
    type?: string
  }>(event)

  const { state = 'open', repo, first = '20', after } = query

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const [owner, repoName] = repo.split('/')
  const resolvedState: 'open' | 'closed' = state === 'closed' ? 'closed' : 'open'
  const pageSize = Math.min(Math.max(Number(first) || 20, 1), 100)
  const page = after ? Number(after) + 1 : 1

  const filters: SearchFilters = {
    q: (query.q as string) || undefined,
    assignee: (query.assignee as string) || undefined,
    author: (query.author as string) || undefined,
    label: (query.label as string) || undefined,
    type: query.type === 'issue' || query.type === 'pr' ? query.type : undefined,
  }

  if (hasSearchFilters(filters)) {
    return searchWorkItems(token, owner!, repoName!, resolvedState, filters, pageSize, page)
  }

  const allItems = await fetchAllWorkItems(login, token, owner!, repoName!, resolvedState)

  const start = (page - 1) * pageSize
  const end = start + pageSize
  const items = allItems.slice(start, end)
  const hasNextPage = end < allItems.length

  return {
    items,
    totalCount: allItems.length,
    pageInfo: {
      hasNextPage,
      endCursor: hasNextPage ? String(page) : null,
    },
  }
})
