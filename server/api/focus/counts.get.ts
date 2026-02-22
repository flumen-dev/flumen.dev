import { parseClaimKey } from '~~/shared/utils/claimKey'

interface ClaimEntry {
  login: string
}

export interface FocusCounts {
  workingOn: number
  createdOpen: number
  createdClosed: number
  inboxReviewRequests: number
  inboxAssigned: number
  inboxMentions: number
  inboxHasNew: boolean
}

const COUNTS_QUERY = /* GraphQL */ `
  query FocusCounts(
    $createdOpen: String!, $createdClosed: String!, $openPrs: String!,
    $reviewRequests: String!, $assigned: String!, $mentions: String!
  ) {
    createdOpen: search(query: $createdOpen, type: ISSUE, first: 1) { issueCount }
    createdClosed: search(query: $createdClosed, type: ISSUE, first: 1) { issueCount }
    openPrs: search(query: $openPrs, type: ISSUE, first: 1) { issueCount }
    reviewRequests: search(query: $reviewRequests, type: ISSUE, first: 1) {
      issueCount
      nodes { ... on PullRequest { updatedAt } }
    }
    assigned: search(query: $assigned, type: ISSUE, first: 1) {
      issueCount
      nodes {
        ... on Issue { updatedAt }
        ... on PullRequest { updatedAt }
      }
    }
    mentions: search(query: $mentions, type: ISSUE, first: 1) {
      issueCount
      nodes {
        ... on Issue { updatedAt }
        ... on PullRequest { updatedAt }
      }
    }
  }
`

interface InboxCountNode {
  updatedAt?: string
}

export default defineEventHandler(async (event): Promise<FocusCounts> => {
  const { token, login, userId } = await getSessionToken(event)

  // 1. KV scan for claimed issues (no GitHub API call)
  const storage = useStorage('data')
  const allKeys = await storage.getKeys('issue-claims')
  let claimedCount = 0
  const loginLower = login.toLowerCase()
  for (const rawKey of allKeys) {
    if (!parseClaimKey(rawKey)) continue
    const claims = await storage.getItem<ClaimEntry[]>(rawKey)
    if (!claims) continue
    if (claims.some(c => c.login.toLowerCase() === loginLower)) {
      claimedCount++
    }
  }

  // 2. Single GraphQL query for all search counts
  const [data, lastOpened] = await Promise.all([
    githubGraphQL<{
      createdOpen: { issueCount: number }
      createdClosed: { issueCount: number }
      openPrs: { issueCount: number }
      reviewRequests: { issueCount: number, nodes: (InboxCountNode | null)[] }
      assigned: { issueCount: number, nodes: (InboxCountNode | null)[] }
      mentions: { issueCount: number, nodes: (InboxCountNode | null)[] }
    }>(token, COUNTS_QUERY, {
      createdOpen: `is:issue is:open author:${login}`,
      createdClosed: `is:issue is:closed author:${login}`,
      openPrs: `type:pr is:open author:${login}`,
      reviewRequests: `is:pr is:open review-requested:${login} sort:updated-desc`,
      assigned: `is:open assignee:${login} -author:${login} sort:updated-desc`,
      mentions: `mentions:${login} is:open -author:${login} sort:updated-desc`,
    }),
    storage.getItem<string>(`users:${userId}:inbox-last-opened`),
  ])

  // 3. Check if any inbox category has items newer than last opened
  const hasNew = (() => {
    if (!lastOpened) return true // never opened = everything is new
    const lastOpenedDate = new Date(lastOpened)
    for (const category of [data.reviewRequests, data.assigned, data.mentions]) {
      const newest = category.nodes[0]
      if (newest?.updatedAt && new Date(newest.updatedAt) > lastOpenedDate) return true
    }
    return false
  })()

  return {
    workingOn: claimedCount + data.openPrs.issueCount,
    createdOpen: data.createdOpen.issueCount,
    createdClosed: data.createdClosed.issueCount,
    inboxReviewRequests: data.reviewRequests.issueCount,
    inboxAssigned: data.assigned.issueCount,
    inboxMentions: data.mentions.issueCount,
    inboxHasNew: hasNew,
  }
})
