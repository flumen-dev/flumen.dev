import type { GQLInboxPR, GQLInboxIssue } from '~~/server/utils/focus-inbox'
import type { PageInfo } from '~~/shared/types/pagination'
import type { UnifiedInboxItem } from '~~/shared/types/inbox'
import { mapPRNode, mapIssueNode } from '~~/server/utils/focus-inbox'
import { applySortToPage } from '~~/shared/utils/inboxSort'

const PR_FIELDS = /* GraphQL */ `
  number title state url updatedAt isDraft
  author { login avatarUrl }
  labels(first: 5) { nodes { name color } }
  repository { nameWithOwner }
  reviewDecision
  additions deletions changedFiles
  mergeable
  headRefName
  comments { totalCount }
  reviewRequests(first: 5) {
    nodes {
      requestedReviewer {
        ... on User { login avatarUrl }
      }
    }
  }
  assignees(first: 3) { nodes { login avatarUrl } }
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
  comments { totalCount }
  assignees(first: 3) { nodes { login avatarUrl } }
`

function buildPageQuery(category: 'pr' | 'issue'): string {
  const fields = category === 'pr'
    ? `... on PullRequest { __typename ${PR_FIELDS} }`
    : `... on Issue { __typename ${ISSUE_FIELDS} }`

  return /* GraphQL */ `
    query InboxPage($q: String!, $first: Int!, $after: String) {
      search(query: $q, type: ISSUE, first: $first, after: $after) {
        issueCount
        pageInfo { hasNextPage endCursor }
        nodes { ${fields} }
      }
    }
  `
}

type SearchResult = {
  search: {
    issueCount: number
    pageInfo: { hasNextPage: boolean, endCursor: string | null }
    nodes: Array<(GQLInboxPR | GQLInboxIssue) | null>
  }
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)

  const query = getQuery(event)
  const category = (query.category as string) === 'issue' ? 'issue' : 'pr'
  const pageSize = Math.min(Math.max(Number(query.first) || 40, 1), 50)
  const after = (query.after as string) || null
  const scope = (query.scope as string) || login
  const repo = (query.repo as string) || ''
  const search = (query.search as string) || ''
  const state = (query.state as string) === 'closed' ? 'closed' : 'open'
  const sort = (query.sort as string) || 'updated'

  // Build search query
  const scopeQualifier = repo
    ? `repo:${repo}`
    : scope === login ? `user:${login}` : `org:${scope}`
  const typeQualifier = category === 'pr' ? 'is:pr' : 'is:issue'
  const stateQualifier = state === 'closed'
    ? (category === 'pr' ? 'is:merged' : 'is:closed')
    : 'is:open'
  const parts = [`${typeQualifier} ${stateQualifier} ${scopeQualifier}`]
  if (search) parts.push(search)

  // GitHub-native sort: age → oldest created first, everything else → recently updated
  parts.push(sort === 'age' ? 'sort:created-asc' : 'sort:updated-desc')
  const searchQ = parts.join(' ')

  // Fetch one page from GitHub
  const pageQuery = buildPageQuery(category)
  const data = await githubGraphQL<SearchResult>(token, pageQuery, {
    q: searchQ,
    first: pageSize,
    after,
  })

  const items: UnifiedInboxItem[] = data.search.nodes
    .filter(Boolean)
    .map(n => category === 'pr'
      ? mapPRNode(n as GQLInboxPR)
      : mapIssueNode(n as GQLInboxIssue),
    )

  // Re-sort the page for urgency/reviewState
  applySortToPage(items, sort)

  const pageInfo: PageInfo = {
    hasNextPage: data.search.pageInfo.hasNextPage,
    endCursor: data.search.pageInfo.endCursor,
  }

  return {
    items,
    totalCount: data.search.issueCount,
    pageInfo,
  }
})
