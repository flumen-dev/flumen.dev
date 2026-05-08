// GitHub Search is quirky: combined OR groups (user OR involves OR org)
// with free-text terms return 0 hits, even when syntactically correct.
// Workaround: run parallel queries per qualifier type, then merge + dedupe.
const MINE_ORG_CAP = 5

const ORG_LOGINS_GQL = `
query {
  viewer {
    organizations(first: ${MINE_ORG_CAP}) {
      nodes { login }
    }
  }
}
`

const ISSUE_PR_SEARCH_GQL = `
query($q: String!, $first: Int!) {
  search(query: $q, type: ISSUE, first: $first) {
    nodes {
      __typename
      ... on Issue {
        id
        number
        title
        state
        updatedAt
        repository { nameWithOwner owner { avatarUrl } }
      }
      ... on PullRequest {
        id
        number
        title
        state
        isDraft
        updatedAt
        repository { nameWithOwner owner { avatarUrl } }
      }
    }
  }
}
`

const REPO_SEARCH_GQL = `
query($q: String!, $first: Int!) {
  search(query: $q, type: REPOSITORY, first: $first) {
    nodes {
      ... on Repository {
        id
        nameWithOwner
        description
        owner { avatarUrl }
      }
    }
  }
}
`

interface GqlIssueNode {
  __typename: 'Issue'
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  updatedAt: string
  repository: { nameWithOwner: string, owner: { avatarUrl: string } }
}

interface GqlPrNode {
  __typename: 'PullRequest'
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  updatedAt: string
  repository: { nameWithOwner: string, owner: { avatarUrl: string } }
}

interface GqlRepoNode {
  id: string
  nameWithOwner: string
  description: string | null
  owner: { avatarUrl: string }
}

interface IssuePrCmdkSearchResponse {
  search: { nodes: (GqlIssueNode | GqlPrNode | null)[] }
}

interface RepoCmdkSearchResponse {
  search: { nodes: (GqlRepoNode | null)[] }
}

// No explicit sort: GitHub's default best-match ranks by relevance, which
// surfaces title matches near the top. `sort:updated-desc` would let high-
// activity repos drown specific matches.
function buildMineQueries(q: string, login: string, orgs: string[]): string[] {
  const queries: string[] = [
    `${q} involves:${login}`,
    `${q} user:${login}`,
  ]
  if (orgs.length > 0) {
    // Same-type qualifiers are OR'd implicitly by GitHub.
    const orgPart = orgs.map(o => `org:${o}`).join(' ')
    queries.push(`${q} ${orgPart}`)
  }
  return queries
}

function mapIssue(node: GqlIssueNode): CmdkSearchResultIssue {
  return {
    kind: 'issue',
    id: node.id,
    number: node.number,
    title: node.title,
    state: node.state.toLowerCase() as 'open' | 'closed',
    repo: node.repository.nameWithOwner,
    ownerAvatarUrl: node.repository.owner.avatarUrl,
    url: `/repos/${node.repository.nameWithOwner}/work-items/${node.number}`,
    updatedAt: node.updatedAt,
  }
}

function mapPr(node: GqlPrNode): CmdkSearchResultPr {
  const state = node.isDraft && node.state === 'OPEN'
    ? 'draft'
    : node.state.toLowerCase() as 'open' | 'closed' | 'merged'
  return {
    kind: 'pr',
    id: node.id,
    number: node.number,
    title: node.title,
    state,
    repo: node.repository.nameWithOwner,
    ownerAvatarUrl: node.repository.owner.avatarUrl,
    url: `/repos/${node.repository.nameWithOwner}/work-items/${node.number}`,
    updatedAt: node.updatedAt,
  }
}

function mapRepo(node: GqlRepoNode): CmdkSearchResultRepo {
  return {
    kind: 'repo',
    id: node.id,
    fullName: node.nameWithOwner,
    description: node.description ?? undefined,
    ownerAvatarUrl: node.owner.avatarUrl,
    url: `/repos/${node.nameWithOwner}`,
  }
}

const fetchOrgLogins = defineCachedFunction(
  async (token: string, _login: string, userId: number): Promise<string[]> => {
    const data: { viewer: { organizations: { nodes: { login: string }[] } } } = await githubGraphQL(
      token,
      ORG_LOGINS_GQL,
      undefined,
      userId,
    )
    return data.viewer.organizations.nodes.map(o => o.login)
  },
  {
    name: 'cmdk-user-orgs',
    getKey: (_token: string, login: string, _userId: number) => login,
    maxAge: 60 * 30,
  },
)

const fetchIssuePrSearch = defineCachedFunction(
  async (token: string, _login: string, userId: number, fullQuery: string): Promise<(CmdkSearchResultIssue | CmdkSearchResultPr)[]> => {
    const data: IssuePrCmdkSearchResponse = await githubGraphQL<IssuePrCmdkSearchResponse>(
      token,
      ISSUE_PR_SEARCH_GQL,
      { q: fullQuery, first: 20 },
      userId,
    )
    const out: (CmdkSearchResultIssue | CmdkSearchResultPr)[] = []
    for (const n of data.search.nodes) {
      if (!n) continue
      if (n.__typename === 'Issue') out.push(mapIssue(n))
      else if (n.__typename === 'PullRequest') out.push(mapPr(n))
    }
    return out
  },
  {
    name: 'cmdk-search-issue-pr',
    getKey: (_token: string, login: string, _userId: number, fullQuery: string) => `${login}:${fullQuery.toLowerCase()}`,
    maxAge: 30,
  },
)

const fetchRepoSearch = defineCachedFunction(
  async (token: string, _login: string, userId: number, q: string): Promise<CmdkSearchResultRepo[]> => {
    const data: RepoCmdkSearchResponse = await githubGraphQL<RepoCmdkSearchResponse>(
      token,
      REPO_SEARCH_GQL,
      { q: `${q} sort:stars-desc`, first: 8 },
      userId,
    )
    return data.search.nodes
      .filter((n): n is GqlRepoNode => n !== null && 'id' in n)
      .map(mapRepo)
  },
  {
    name: 'cmdk-search-repo',
    getKey: (_token: string, login: string, _userId: number, q: string) => `${login}:${q.toLowerCase()}`,
    maxAge: 30,
  },
)

export default defineEventHandler(async (event): Promise<CmdkSearchResponse> => {
  const { token, login, userId } = await getSessionToken(event)
  const query = getQuery<{ q?: string, scope?: string }>(event)
  // Cap q tighter when scope=mine — qualifiers eat into GitHub's 256-char query budget.
  const scope: CmdkSearchScope = query.scope === 'global' ? 'global' : 'mine'
  const q = (query.q ?? '').trim().slice(0, scope === 'mine' ? 100 : 200)

  if (q.length < 2) {
    return { scope, query: q, results: [] }
  }

  const orgs = scope === 'mine' ? await fetchOrgLogins(token, login, userId).catch(() => []) : []

  const issuePrQueries = scope === 'mine'
    ? buildMineQueries(q, login, orgs)
    : [q]

  const tasks: Promise<CmdkSearchResult[]>[] = issuePrQueries.map(fullQuery =>
    fetchIssuePrSearch(token, login, userId, fullQuery),
  )
  if (scope === 'global') {
    tasks.push(fetchRepoSearch(token, login, userId, q))
  }

  const settled = await Promise.allSettled(tasks)
  const merged = new Map<string, CmdkSearchResult>()
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      for (const item of r.value) {
        // Dedupe by id; first occurrence wins. Query order (involves → user →
        // orgs) is preserved by Promise.allSettled, so the most personally
        // relevant ranking surfaces first.
        if (!merged.has(item.id)) merged.set(item.id, item)
      }
    }
    else {
      console.error('[cmdk-search] task failed:', r.reason)
    }
  }

  return { scope, query: q, results: [...merged.values()] }
})
