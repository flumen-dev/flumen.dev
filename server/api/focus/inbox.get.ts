import type { InboxItem } from '~~/shared/types/inbox'
import type { PaginatedResponse } from '~~/shared/types/pagination'
import type { GQLInboxPR, GQLInboxIssue } from '~~/server/utils/focus-inbox'
import { mapPRNode, mapMixedNode } from '~~/server/utils/focus-inbox'

type InboxCategory = 'reviewRequests' | 'assigned' | 'mentions'

const PR_FIELDS = /* GraphQL */ `
  number title state url updatedAt isDraft
  author { login avatarUrl }
  labels(first: 5) { nodes { name color } }
  repository { nameWithOwner }
  reviewDecision
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup { state }
      }
    }
  }
`

const ISSUE_FIELDS = /* GraphQL */ `
  number title state url updatedAt
  author { login avatarUrl }
  labels(first: 5) { nodes { name color } }
  repository { nameWithOwner }
`

const MIXED_FIELDS = /* GraphQL */ `
  ... on Issue {
    __typename
    ${ISSUE_FIELDS}
  }
  ... on PullRequest {
    __typename
    ${PR_FIELDS}
  }
`

function buildQuery(category: InboxCategory): string {
  if (category === 'reviewRequests') {
    return /* GraphQL */ `
      query InboxReviewRequests($q: String!, $first: Int!, $after: String) {
        search(query: $q, type: ISSUE, first: $first, after: $after) {
          issueCount
          pageInfo { hasNextPage endCursor }
          nodes {
            ... on PullRequest { ${PR_FIELDS} }
          }
        }
      }
    `
  }
  // assigned + mentions both return mixed Issue/PR results
  return /* GraphQL */ `
    query InboxMixed($q: String!, $first: Int!, $after: String) {
      search(query: $q, type: ISSUE, first: $first, after: $after) {
        issueCount
        pageInfo { hasNextPage endCursor }
        nodes { ${MIXED_FIELDS} }
      }
    }
  `
}

interface InboxFilters {
  search?: string
  repo?: string
}

function buildSearchQuery(category: InboxCategory, login: string, filters?: InboxFilters): string {
  const queries: Record<InboxCategory, string> = {
    reviewRequests: `is:pr is:open review-requested:${login} sort:updated-desc`,
    assigned: `is:open assignee:${login} -author:${login} sort:updated-desc`,
    mentions: `mentions:${login} is:open -author:${login} sort:updated-desc`,
  }
  let q = queries[category]
  if (filters?.repo) q += ` repo:${filters.repo}`
  if (filters?.search) q += ` ${filters.search}`
  return q
}

export default defineEventHandler(async (event): Promise<PaginatedResponse<InboxItem>> => {
  const { token, login, userId } = await getSessionToken(event)

  const query = getQuery(event)
  const category = (query.category as InboxCategory) || 'reviewRequests'
  const first = Math.min(Math.max(Number(query.first) || 20, 1), 50)
  const after = (query.after as string) || undefined
  const search = (query.search as string) || undefined
  const repo = (query.repo as string) || undefined

  if (!['reviewRequests', 'assigned', 'mentions'].includes(category)) {
    throw createError({ statusCode: 400, message: 'Invalid category' })
  }

  // Read tracking state
  const storage = useStorage('data')
  const [lastOpened, dismissedRaw] = await Promise.all([
    storage.getItem<string>(`users:${userId}:inbox-last-opened`),
    storage.getItem<Record<string, string>>(`users:${userId}:inbox-dismissed`),
  ])
  const dismissedSet = new Set(Object.keys(dismissedRaw ?? {}))

  const data = await githubGraphQL<{
    search: {
      issueCount: number
      pageInfo: { hasNextPage: boolean, endCursor: string | null }
      nodes: Array<(GQLInboxIssue | GQLInboxPR) | null>
    }
  }>(token, buildQuery(category), {
    q: buildSearchQuery(category, login, { search, repo }),
    first,
    after: after ?? null,
  })

  const items = data.search.nodes
    .filter(Boolean)
    .map((n) => {
      const item = category === 'reviewRequests' ? mapPRNode(n as GQLInboxPR) : mapMixedNode(n!)
      const itemKey = `${item.repo}#${item.number}`
      item.isNew = !lastOpened || new Date(item.updatedAt) > new Date(lastOpened)
      item.isDismissed = dismissedSet.has(itemKey)
      return item
    })

  return {
    items,
    totalCount: data.search.issueCount,
    pageInfo: data.search.pageInfo,
  }
})
