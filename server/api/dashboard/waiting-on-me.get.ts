import type { WaitingOnMeItem, WaitingOnMeResponse } from '~~/shared/types/waiting-on-me'

const PAGE_SIZE = 30

// --- GraphQL queries ---

const REVIEW_REQUESTED_QUERY = /* GraphQL */ `
  query ReviewRequested($query: String!, $first: Int!, $after: String) {
    search(query: $query, type: ISSUE, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          number
          title
          url
          createdAt
          updatedAt
          isDraft
          additions
          deletions
          repository { nameWithOwner }
          author { login avatarUrl }
          labels(first: 5) { nodes { name color } }
          comments { totalCount }
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        }
      }
    }
  }
`

const ASSIGNED_ISSUES_QUERY = /* GraphQL */ `
  query AssignedIssues($query: String!, $first: Int!, $after: String) {
    search(query: $query, type: ISSUE, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on Issue {
          number
          title
          url
          createdAt
          updatedAt
          repository { nameWithOwner viewerPermission }
          author { login avatarUrl }
          labels(first: 5) { nodes { name color } }
          comments { totalCount }
          lastComments: comments(last: 1) {
            nodes {
              author { login avatarUrl }
              createdAt
            }
          }
        }
      }
    }
  }
`

const CHANGES_REQUESTED_QUERY = /* GraphQL */ `
  query ChangesRequested($query: String!, $first: Int!, $after: String) {
    search(query: $query, type: ISSUE, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          number
          title
          url
          createdAt
          updatedAt
          isDraft
          additions
          deletions
          repository { nameWithOwner }
          author { login avatarUrl }
          labels(first: 5) { nodes { name color } }
          comments { totalCount }
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
          reviews(last: 5, states: [CHANGES_REQUESTED]) {
            nodes {
              author { login avatarUrl }
              createdAt
            }
          }
        }
      }
    }
  }
`

// --- Types for raw GraphQL responses ---

interface GQLAuthor {
  login: string
  avatarUrl: string
}

interface GQLLabel {
  name: string
  color: string
}

interface GQLSearchResult<T> {
  search: {
    pageInfo: { hasNextPage: boolean, endCursor: string | null }
    nodes: T[]
  }
}

interface PRExtras {
  isDraft: boolean
  additions: number
  deletions: number
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> }
}

interface ReviewRequestedNode extends PRExtras {
  number: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  repository: { nameWithOwner: string }
  author: GQLAuthor
  labels: { nodes: GQLLabel[] }
  comments: { totalCount: number }
}

interface AssignedIssueNode {
  number: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  repository: { nameWithOwner: string, viewerPermission: string }
  author: GQLAuthor
  labels: { nodes: GQLLabel[] }
  comments: { totalCount: number }
  lastComments: {
    nodes: Array<{
      author: GQLAuthor | null
      createdAt: string
    }>
  }
}

interface ChangesRequestedNode extends PRExtras {
  number: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  repository: { nameWithOwner: string }
  author: GQLAuthor
  labels: { nodes: GQLLabel[] }
  comments: { totalCount: number }
  reviews: {
    nodes: Array<{
      author: GQLAuthor | null
      createdAt: string
    }>
  }
}

function extractCIStatus(node: PRExtras): WaitingOnMeItem['ciStatus'] {
  const rollup = node.commits.nodes[0]?.commit.statusCheckRollup
  return (rollup?.state as WaitingOnMeItem['ciStatus']) ?? null
}

function computeSummary(items: WaitingOnMeItem[]): WaitingOnMeResponse['summary'] {
  const uniquePeople = new Set(items.map(i => i.requester.login))
  const totalDays = items.reduce((sum, i) => sum + i.waitingDays, 0)
  return {
    totalItems: items.length,
    uniquePeopleBlocked: uniquePeople.size,
    averageWaitDays: items.length > 0 ? Math.round(totalDays / items.length) : 0,
  }
}

const EMPTY_SEARCH = { search: { issueCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } }

async function fetchPage(
  token: string,
  login: string,
  cursors: { review?: string | false, assigned?: string | false, changes?: string | false },
): Promise<WaitingOnMeResponse> {
  const now = new Date()

  // false = category exhausted, skip entirely. undefined = first page (no cursor).
  const [reviewData, assignedData, changesData] = await Promise.all([
    cursors.review === false
      ? EMPTY_SEARCH as GQLSearchResult<ReviewRequestedNode>
      : githubGraphQL<GQLSearchResult<ReviewRequestedNode>>(
          token,
          REVIEW_REQUESTED_QUERY,
          {
            query: `is:pr is:open review-requested:${login}`,
            first: PAGE_SIZE,
            after: cursors.review || null,
          },
        ),
    cursors.assigned === false
      ? EMPTY_SEARCH as GQLSearchResult<AssignedIssueNode>
      : githubGraphQL<GQLSearchResult<AssignedIssueNode>>(
          token,
          ASSIGNED_ISSUES_QUERY,
          {
            query: `is:issue is:open assignee:${login}`,
            first: PAGE_SIZE,
            after: cursors.assigned || null,
          },
        ),
    cursors.changes === false
      ? EMPTY_SEARCH as GQLSearchResult<ChangesRequestedNode>
      : githubGraphQL<GQLSearchResult<ChangesRequestedNode>>(
          token,
          CHANGES_REQUESTED_QUERY,
          {
            query: `is:pr is:open author:${login} review:changes_requested`,
            first: PAGE_SIZE,
            after: cursors.changes || null,
          },
        ),
  ])

  const items: WaitingOnMeItem[] = []
  const loginLower = login.toLowerCase()

  // 1. PRs where I'm requested as reviewer
  for (const node of reviewData.search.nodes) {
    if (!node.number) continue
    items.push({
      category: 'review-requested',
      type: 'pr',
      number: node.number,
      title: node.title,
      url: node.url,
      repo: node.repository.nameWithOwner,
      createdAt: node.createdAt,
      waitingSince: node.updatedAt,
      waitingDays: daysBetween(node.updatedAt, now),
      commentsCount: node.comments.totalCount,
      isDraft: node.isDraft,
      additions: node.additions,
      deletions: node.deletions,
      ciStatus: extractCIStatus(node),
      author: node.author,
      requester: node.author,
      labels: node.labels.nodes,
    })
  }

  // 2. Issues assigned to me where last comment is not from me
  //    Only if I'm a maintainer (ADMIN/MAINTAIN/WRITE) — contributors don't block
  const maintainerPerms = new Set(['ADMIN', 'MAINTAIN', 'WRITE'])
  for (const node of assignedData.search.nodes) {
    if (!node.number) continue
    if (!maintainerPerms.has(node.repository.viewerPermission)) continue
    const lastComment = node.lastComments.nodes[0]
    const lastCommentAuthor = lastComment?.author?.login?.toLowerCase()

    if (lastCommentAuthor === loginLower) continue

    const waitingSince = lastComment?.createdAt ?? node.createdAt
    const requester = lastComment?.author ?? node.author

    items.push({
      category: 'needs-response',
      type: 'issue',
      number: node.number,
      title: node.title,
      url: node.url,
      repo: node.repository.nameWithOwner,
      createdAt: node.createdAt,
      waitingSince,
      waitingDays: daysBetween(waitingSince, now),
      commentsCount: node.comments.totalCount,
      isDraft: null,
      additions: null,
      deletions: null,
      ciStatus: null,
      author: node.author,
      requester,
      labels: node.labels.nodes,
    })
  }

  // 3. My PRs with changes requested
  for (const node of changesData.search.nodes) {
    if (!node.number) continue
    const lastReview = node.reviews.nodes[node.reviews.nodes.length - 1]
    if (!lastReview) continue

    const requester = lastReview.author ?? node.author

    items.push({
      category: 'changes-requested',
      type: 'pr',
      number: node.number,
      title: node.title,
      url: node.url,
      repo: node.repository.nameWithOwner,
      createdAt: node.createdAt,
      waitingSince: lastReview.createdAt,
      waitingDays: daysBetween(lastReview.createdAt, now),
      commentsCount: node.comments.totalCount,
      isDraft: node.isDraft,
      additions: node.additions,
      deletions: node.deletions,
      ciStatus: extractCIStatus(node),
      author: node.author,
      requester,
      labels: node.labels.nodes,
    })
  }

  items.sort((a, b) => new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime())

  const hasMore
    = reviewData.search.pageInfo.hasNextPage
      || assignedData.search.pageInfo.hasNextPage
      || changesData.search.pageInfo.hasNextPage

  return {
    items,
    summary: computeSummary(items),
    hasMore,
    cursors: {
      review: reviewData.search.pageInfo.hasNextPage ? reviewData.search.pageInfo.endCursor : null,
      assigned: assignedData.search.pageInfo.hasNextPage ? assignedData.search.pageInfo.endCursor : null,
      changes: changesData.search.pageInfo.hasNextPage ? changesData.search.pageInfo.endCursor : null,
    },
  }
}

const CACHE_MAX_AGE = 60 * 5
const CACHE_GROUP = 'nitro:functions'
const CACHE_NAME = 'waiting-on-me'

const fetchFirstPage = defineCachedFunction(
  async (token: string, login: string): Promise<WaitingOnMeResponse> => {
    return fetchPage(token, login, {})
  },
  {
    maxAge: CACHE_MAX_AGE,
    name: CACHE_NAME,
    getKey: (_token: string, login: string) => login,
  },
)

function cacheKey(login: string) {
  return `${CACHE_GROUP}:${CACHE_NAME}:${login}.json`
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const query = getQuery(event)

  const cursorReview = query.cursorReview as string | undefined
  const cursorAssigned = query.cursorAssigned as string | undefined
  const cursorChanges = query.cursorChanges as string | undefined

  const hasCursors = cursorReview || cursorAssigned || cursorChanges

  if (!hasCursors) {
    return fetchFirstPage(token, login)
  }

  // Load more: fetch next page
  const newPage = await fetchPage(token, login, {
    review: cursorReview || false,
    assigned: cursorAssigned || false,
    changes: cursorChanges || false,
  })

  // Read cached first page, merge with new items
  const storage = useStorage('cache')
  const cached = await storage.getItem<{ value: WaitingOnMeResponse }>(cacheKey(login))
  const existingItems = cached?.value?.items ?? []

  const seen = new Set(existingItems.map(i => `${i.repo}#${i.number}`))
  const merged = [...existingItems]
  for (const item of newPage.items) {
    const key = `${item.repo}#${item.number}`
    if (!seen.has(key)) {
      merged.push(item)
      seen.add(key)
    }
  }
  merged.sort((a, b) => new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime())

  const result: WaitingOnMeResponse = {
    items: merged,
    summary: computeSummary(merged),
    hasMore: newPage.hasMore,
    cursors: newPage.cursors,
  }

  // Overwrite cache with merged data
  await storage.setItem(cacheKey(login), {
    value: result,
    expires: Date.now() + CACHE_MAX_AGE * 1000,
  })

  return result
})
