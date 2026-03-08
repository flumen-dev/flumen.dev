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

    const issueMap = new Map<number, RepoIssue>(issues.map(issue => [issue.number, issue]))
    const linkedPullsByIssue = new Map<number, RepoPullRequest[]>()
    const linkedIssueNumbersByPull = new Map<number, number[]>()

    for (const pull of pullsResponse.data) {
      const linkedIssueNumbers = Array.from(new Set(collectIssueLinksFromText(pull.body)))
      linkedIssueNumbersByPull.set(pull.number, linkedIssueNumbers)

      for (const issueNumber of linkedIssueNumbers) {
        if (!issueMap.has(issueNumber)) continue
        const current = linkedPullsByIssue.get(issueNumber) ?? []
        const mappedPull = toRepoPullRequest(pull)
        linkedPullsByIssue.set(issueNumber, [...current, mappedPull])
      }
    }

    const issueWorkItems: WorkItem[] = issues.map((issue) => {
      const linkedPulls = linkedPullsByIssue.get(issue.number) ?? []
      const primaryLinkedPull = linkedPulls[0] ?? null
      const linkedInsight = primaryLinkedPull ? pullInsights.get(primaryLinkedPull.number) : null
      return {
        id: String(issue.number),
        type: 'issue',
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
          type: 'pull',
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
        const pullInsight = pullInsights.get(pr.number)
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
          reviewDecision: pullInsight?.reviewDecision ?? null,
          ciStatus: pullInsight?.ciStatus ?? null,
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
  },
  {
    maxAge: 120,
    name: 'work-items-paginated',
    getKey: (login: string, _token: string, owner: string, repo: string, state: 'open' | 'closed') =>
      `${login}/${owner}/${repo}:${state}`,
  },
)

export default defineEventHandler(async (event): Promise<PaginatedResponse<WorkItem>> => {
  const { token, login } = await getSessionToken(event)
  const { state = 'open', repo, first = '20', after } = getQuery<{
    state?: string
    repo?: string
    first?: string
    after?: string
  }>(event)

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const [owner, repoName] = repo.split('/')
  const resolvedState: 'open' | 'closed' = state === 'closed' ? 'closed' : 'open'
  const pageSize = Math.min(Math.max(Number(first) || 20, 1), 100)
  const page = after ? Number(after) + 1 : 1

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
