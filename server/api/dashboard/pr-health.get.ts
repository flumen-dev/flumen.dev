import type { PRHealthResponse } from '~~/shared/types/pr-health'
import type { GQLPRNode } from '~~/server/utils/pr-health'
import {
  classifyBaseNode,
  computeSummary,
  deduplicateItems,
  mapNode,
  CATEGORY_PRIORITY,
} from '~~/server/utils/pr-health'

const PAGE_SIZE = 30

// --- GraphQL queries ---

const PR_FIELDS = /* GraphQL */ `
  number
  title
  url
  createdAt
  updatedAt
  isDraft
  additions
  deletions
  mergeable
  headRefName
  reviewDecision
  repository { nameWithOwner }
  author { login avatarUrl }
  labels(first: 5) { nodes { name color } }
  reviewRequests(first: 5) {
    nodes {
      requestedReviewer {
        ... on User { login avatarUrl }
      }
    }
  }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
`

const SEARCH_QUERY = /* GraphQL */ `
  query PRHealthSearch($query: String!, $first: Int!) {
    search(query: $query, type: ISSUE, first: $first) {
      nodes {
        ... on PullRequest { ${PR_FIELDS} }
      }
    }
  }
`

interface GQLSearchResult {
  search: {
    nodes: GQLPRNode[]
  }
}

const CACHE_MAX_AGE = 60 * 5

const fetchPRHealth = defineCachedFunction(
  async (token: string, login: string): Promise<PRHealthResponse> => {
    const now = new Date()

    const [baseData, approvedData, noReviewData] = await Promise.all([
      githubGraphQL<GQLSearchResult>(
        token,
        SEARCH_QUERY,
        { query: `is:pr is:open author:${login}`, first: PAGE_SIZE },
      ),
      githubGraphQL<GQLSearchResult>(
        token,
        SEARCH_QUERY,
        { query: `is:pr is:open author:${login} review:approved -is:draft`, first: PAGE_SIZE },
      ),
      githubGraphQL<GQLSearchResult>(
        token,
        SEARCH_QUERY,
        { query: `is:pr is:open author:${login} review:none -is:draft`, first: PAGE_SIZE },
      ),
    ])

    const allItems = []

    // 1. Base query: post-filter into ci-failing, merge-conflict, stale-draft
    for (const node of baseData.search.nodes) {
      if (!node.number) continue
      allItems.push(...classifyBaseNode(node, now))
    }

    // 2. Approved but not merged
    for (const node of approvedData.search.nodes) {
      if (!node.number) continue
      allItems.push(mapNode(node, 'approved-not-merged', now))
    }

    // 3. No reviews — only if no reviewers requested either
    for (const node of noReviewData.search.nodes) {
      if (!node.number) continue
      if (node.reviewRequests.nodes.filter(n => n.requestedReviewer !== null).length === 0) {
        allItems.push(mapNode(node, 'needs-reviewers', now))
      }
    }

    // Deduplicate: keep highest-severity category per PR
    const items = deduplicateItems(allItems)

    // Sort by severity priority, then by age (oldest first)
    items.sort((a, b) => {
      const pa = CATEGORY_PRIORITY.indexOf(a.category)
      const pb = CATEGORY_PRIORITY.indexOf(b.category)
      if (pa !== pb) return pa - pb
      return b.ageDays - a.ageDays
    })

    return {
      items,
      summary: computeSummary(items),
    }
  },
  {
    maxAge: CACHE_MAX_AGE,
    name: 'pr-health',
    getKey: (_token: string, login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  return fetchPRHealth(token, login)
})
