import { parseClaimKey } from '~~/shared/utils/claimKey'
import type { UserSettings } from '~~/shared/types/settings'

interface ClaimEntry {
  login: string
}

export interface FocusCounts {
  workingOn: number
  createdOpen: number
  createdClosed: number
  inbox: number
}

const COUNTS_QUERY = /* GraphQL */ `
  query FocusCounts(
    $createdOpen: String!, $createdClosed: String!, $openPrs: String!,
    $inboxPrs: String!, $inboxIssues: String!
  ) {
    createdOpen: search(query: $createdOpen, type: ISSUE, first: 1) { issueCount }
    createdClosed: search(query: $createdClosed, type: ISSUE, first: 1) { issueCount }
    openPrs: search(query: $openPrs, type: ISSUE, first: 1) { issueCount }
    inboxPrs: search(query: $inboxPrs, type: ISSUE, first: 1) { issueCount }
    inboxIssues: search(query: $inboxIssues, type: ISSUE, first: 1) { issueCount }
  }
`

export default defineEventHandler(async (event): Promise<FocusCounts> => {
  const { token, login, userId } = await getSessionToken(event)

  const storage = useStorage('data')

  // KV scan for claimed issues (no GitHub API call)
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

  // Inbox count: use same scope logic as inbox-unified endpoint
  const settings = await storage.getItem<UserSettings>(`users:${userId}:settings`)
  const inboxScope = settings?.inboxScope || login

  // Build scope qualifier identical to inbox-unified.get.ts
  const scopeQualifier = inboxScope === login ? `user:${login}` : `org:${inboxScope}`

  const baseVars = {
    createdOpen: `is:issue is:open author:${login}`,
    createdClosed: `is:issue is:closed author:${login}`,
    openPrs: `type:pr is:open author:${login}`,
  }

  const data = await githubGraphQL<{
    createdOpen: { issueCount: number }
    createdClosed: { issueCount: number }
    openPrs: { issueCount: number }
    inboxPrs: { issueCount: number }
    inboxIssues: { issueCount: number }
  }>(token, COUNTS_QUERY, {
    ...baseVars,
    inboxPrs: `is:pr is:open ${scopeQualifier} sort:updated-desc`,
    inboxIssues: `is:issue is:open ${scopeQualifier} sort:updated-desc`,
  })

  return {
    workingOn: claimedCount + data.openPrs.issueCount,
    createdOpen: data.createdOpen.issueCount,
    createdClosed: data.createdClosed.issueCount,
    inbox: data.inboxPrs.issueCount + data.inboxIssues.issueCount,
  }
})
