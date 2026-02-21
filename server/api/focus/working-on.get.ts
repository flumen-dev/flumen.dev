import { parseClaimKey } from '~~/shared/utils/claimKey'

interface ClaimEntry {
  login: string
  branchName: string
  claimedAt: string
}

export interface FocusItem {
  type: 'issue' | 'pr'
  repo: string
  number: number
  title: string
  state: string
  url: string
  updatedAt: string
  labels: Array<{ name: string, color: string }>
  branchName?: string
  claimedAt?: string
  isDraft?: boolean
}

export interface WorkingOnResponse {
  items: FocusItem[]
}

const MY_PRS_QUERY = /* GraphQL */ `
  query FocusPRs($query: String!) {
    search(query: $query, type: ISSUE, first: 20) {
      nodes {
        ... on PullRequest {
          number
          title
          state
          url
          updatedAt
          isDraft
          labels(first: 5) { nodes { name color } }
          repository { nameWithOwner }
        }
      }
    }
  }
`

export default defineEventHandler(async (event): Promise<WorkingOnResponse> => {
  const { token, login } = await getSessionToken(event)
  const storage = useStorage('data')

  // 1. Scan all claim keys to find this user's claims
  //    getKeys('issue-claims') returns keys like "issue-claims:owner/repo#number"
  const allKeys = await storage.getKeys('issue-claims')
  const myClaims: Array<{ repo: string, number: number, branchName: string, claimedAt: string }> = []

  for (const rawKey of allKeys) {
    // getKeys returns full keys — read with the exact key returned
    const claims = await storage.getItem<ClaimEntry[]>(rawKey)
    if (!claims) continue
    const mine = claims.find(c => c.login === login)
    if (!mine) continue

    const parsed = parseClaimKey(rawKey)
    if (!parsed) continue

    myClaims.push({
      repo: parsed.repo,
      number: parsed.number,
      branchName: mine.branchName,
      claimedAt: mine.claimedAt,
    })
  }

  const items: FocusItem[] = []

  // 2. Fetch claimed issues via GraphQL (batched by node ID lookup)
  //    We need issue node IDs — but we only have repo+number. Use search instead.
  if (myClaims.length > 0) {
    // Build a GraphQL query with aliases for each claimed issue
    const fragments = myClaims.map((c, i) => {
      const [owner, repo] = c.repo.split('/')
      return `i${i}: repository(owner: "${owner}", name: "${repo}") {
        issue(number: ${c.number}) {
          number title state url updatedAt
          labels(first: 5) { nodes { name color } }
          repository { nameWithOwner }
        }
      }`
    }).join('\n')

    const query = `query { ${fragments} }`

    try {
      const data = await githubGraphQL<Record<string, {
        issue: {
          number: number
          title: string
          state: string
          url: string
          updatedAt: string
          labels: { nodes: Array<{ name: string, color: string }> }
          repository: { nameWithOwner: string }
        } | null
      }>>(token, query)

      for (let i = 0; i < myClaims.length; i++) {
        const result = data[`i${i}`]?.issue
        if (!result) continue
        const claim = myClaims[i]!

        items.push({
          type: 'issue',
          repo: result.repository.nameWithOwner,
          number: result.number,
          title: result.title,
          state: result.state,
          url: result.url,
          updatedAt: result.updatedAt,
          labels: result.labels.nodes,
          branchName: claim.branchName,
          claimedAt: claim.claimedAt,
        })
      }
    }
    catch {
      // If GraphQL fails (e.g. deleted repos), continue with PRs
    }
  }

  // 3. Fetch user's open PRs (single search query)
  try {
    const data = await githubGraphQL<{
      search: {
        nodes: Array<{
          number: number
          title: string
          state: string
          url: string
          updatedAt: string
          isDraft: boolean
          labels: { nodes: Array<{ name: string, color: string }> }
          repository: { nameWithOwner: string }
        }>
      }
    }>(token, MY_PRS_QUERY, {
      query: `type:pr author:${login} is:open`,
    })

    for (const pr of data.search.nodes) {
      // Skip PRs that are already represented by a claimed issue
      items.push({
        type: 'pr',
        repo: pr.repository.nameWithOwner,
        number: pr.number,
        title: pr.title,
        state: pr.isDraft ? 'DRAFT' : pr.state,
        url: pr.url,
        updatedAt: pr.updatedAt,
        labels: pr.labels.nodes,
        isDraft: pr.isDraft,
      })
    }
  }
  catch {
    // PR fetch failed — return what we have
  }

  return { items }
})
