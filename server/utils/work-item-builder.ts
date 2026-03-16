import type { GitHubIssue, GitHubPullRequest, RepoIssue, RepoPullRequest } from '~~/shared/types/repository'
import type { WorkItem } from '~~/shared/types/work-item'
import { githubGraphQL } from '~~/server/utils/github-graphql'
import { mapCiStatus } from '~~/server/utils/focus-created'
import { toRepoIssue, toRepoPullRequest } from '~~/shared/utils/repository'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type GitHubIssueWithPull = GitHubIssue & { pull_request?: { url?: string } | unknown }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ISSUE_LINK_REGEX = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:#|(?:[\w.-]+\/)?[\w.-]+#)(\d+)/gi

export function collectIssueLinksFromText(text: string | null | undefined): number[] {
  if (!text) return []
  const links: number[] = []
  for (const match of text.matchAll(ISSUE_LINK_REGEX)) {
    const num = Number(match[1])
    if (num && !Number.isNaN(num)) links.push(num)
  }
  return links
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export function filterByState(items: WorkItem[], state: 'open' | 'closed' | 'all'): WorkItem[] {
  if (state === 'all') return items
  return items.filter(item => item.state === state)
}

// ---------------------------------------------------------------------------
// Pull Insights (GraphQL batch query for reviewDecision + ciStatus)
// ---------------------------------------------------------------------------
export async function fetchPullInsights(
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
      for (const pull of Object.values(repository)) {
        if (!pull) continue
        const ciRaw = pull.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
        result.set(pull.number, {
          reviewDecision: pull.reviewDecision ?? null,
          ciStatus: mapCiStatus(ciRaw),
        })
      }

      for (const pullNumber of batch) {
        if (!result.has(pullNumber)) {
          result.set(pullNumber, { reviewDecision: null, ciStatus: null })
        }
      }
    }
    catch (error) {
      console.error('[work-item-builder] Failed to fetch pull insights batch', { owner, repo, batch, error })
      for (const pullNumber of batch) {
        if (!result.has(pullNumber)) {
          result.set(pullNumber, { reviewDecision: null, ciStatus: null })
        }
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Build WorkItems from raw GitHub data
// ---------------------------------------------------------------------------
export async function buildWorkItemsFromRaw(
  token: string,
  owner: string,
  repo: string,
  issues: GitHubIssueWithPull[],
  pullDetailsByNumber: Map<number, GitHubPullRequest & { body?: string }>,
): Promise<WorkItem[]> {
  const mappedIssues = issues
    .filter(i => !('pull_request' in i))
    .map(i => toRepoIssue(i))

  const mappedPulls = issues
    .filter(i => 'pull_request' in i)
    .map((issue) => {
      const detail = pullDetailsByNumber.get(issue.number)
      if (detail) return toRepoPullRequest(detail)

      return {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        draft: false,
        htmlUrl: issue.html_url,
        comments: issue.comments,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        user: { login: issue.user.login, avatarUrl: issue.user.avatar_url },
        labels: issue.labels,
        assignees: issue.assignees.map(a => ({ login: a.login, avatarUrl: a.avatar_url })),
        requestedReviewers: [],
        milestone: issue.milestone?.title ?? null,
        headRef: '',
      } satisfies RepoPullRequest
    })

  const pullInsights = await fetchPullInsights(token, owner, repo, mappedPulls.map(pr => pr.number))

  const issueMap = new Map<number, RepoIssue>(mappedIssues.map(issue => [issue.number, issue]))
  const linkedPullsByIssue = new Map<number, RepoPullRequest[]>()
  const linkedIssueNumbersByPull = new Map<number, number[]>()

  for (const pull of mappedPulls) {
    const pullDetail = pullDetailsByNumber.get(pull.number)
    const linkedIssueNumbers = Array.from(new Set(collectIssueLinksFromText(pullDetail?.body)))
    linkedIssueNumbersByPull.set(pull.number, linkedIssueNumbers)

    for (const issueNumber of linkedIssueNumbers) {
      if (!issueMap.has(issueNumber)) continue
      const current = linkedPullsByIssue.get(issueNumber) ?? []
      linkedPullsByIssue.set(issueNumber, [...current, pullDetail ? toRepoPullRequest(pullDetail) : pull])
    }
  }

  const issueWorkItems: WorkItem[] = mappedIssues.map((issue) => {
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

  const standalonePullWorkItems: WorkItem[] = mappedPulls
    .filter((pr) => {
      const linkedIssues = linkedIssueNumbersByPull.get(pr.number) ?? []
      return linkedIssues.length === 0 || linkedIssues.every(num => !issueMap.has(num))
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
        linkedIssues: (linkedIssueNumbersByPull.get(pr.number) ?? []).map(num => ({
          type: 'issue' as const,
          number: num,
          title: issueMap.get(num)?.title ?? `#${num}`,
          state: issueMap.get(num)?.state,
          htmlUrl: issueMap.get(num)?.htmlUrl ?? `https://github.com/${owner}/${repo}/issues/${num}`,
        })),
      }
    })

  return [...issueWorkItems, ...standalonePullWorkItems]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}
