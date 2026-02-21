import { parseClaimKey } from '~~/shared/utils/claimKey'

interface ClaimEntry {
  login: string
}

export interface FocusCounts {
  workingOn: number
  createdOpen: number
  createdClosed: number
}

const COUNTS_QUERY = /* GraphQL */ `
  query FocusCounts($createdOpen: String!, $createdClosed: String!, $openPrs: String!) {
    createdOpen: search(query: $createdOpen, type: ISSUE, first: 1) { issueCount }
    createdClosed: search(query: $createdClosed, type: ISSUE, first: 1) { issueCount }
    openPrs: search(query: $openPrs, type: ISSUE, first: 1) { issueCount }
  }
`

export default defineEventHandler(async (event): Promise<FocusCounts> => {
  const { token, login } = await getSessionToken(event)

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
  const data = await githubGraphQL<{
    createdOpen: { issueCount: number }
    createdClosed: { issueCount: number }
    openPrs: { issueCount: number }
  }>(token, COUNTS_QUERY, {
    createdOpen: `is:issue is:open author:${login}`,
    createdClosed: `is:issue is:closed author:${login}`,
    openPrs: `type:pr is:open author:${login}`,
  })

  return {
    workingOn: claimedCount + data.openPrs.issueCount,
    createdOpen: data.createdOpen.issueCount,
    createdClosed: data.createdClosed.issueCount,
  }
})
