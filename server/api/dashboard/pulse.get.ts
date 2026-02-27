interface GQLItemNode {
  __typename?: string
  title?: string
  number?: number
  url?: string
  repository?: { nameWithOwner: string }
  createdAt?: string
  closedAt?: string
  mergedAt?: string
}

interface GQLSearchAlias {
  issueCount: number
  nodes?: GQLItemNode[]
}

interface GQLRepoNode {
  nameWithOwner: string
  viewerPermission: 'ADMIN' | 'MAINTAIN' | 'WRITE' | 'TRIAGE' | 'READ' | null
}

interface GQLReposResult {
  viewer: {
    repositories: {
      nodes: GQLRepoNode[]
      pageInfo: { hasNextPage: boolean, endCursor: string | null }
    }
  }
}

const ITEM_FIELDS = /* GraphQL */ `
  __typename
  ... on Issue {
    title number url createdAt closedAt
    repository { nameWithOwner }
  }
  ... on PullRequest {
    title number url createdAt mergedAt
    repository { nameWithOwner }
  }
`

const REPOS_QUERY = /* GraphQL */ `
  query MaintainedRepos($first: Int!, $after: String) {
    viewer {
      repositories(
        first: $first
        after: $after
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
      ) {
        nodes { nameWithOwner viewerPermission }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

const MAINTAINER_PERMS = new Set(['ADMIN', 'MAINTAIN', 'WRITE'])

// GitHub repo names: alphanumeric, hyphens, dots, underscores, slashes
const SAFE_REPO_NAME = /^[\w./-]+$/

async function fetchMaintainedRepos(token: string): Promise<string[]> {
  const repos: string[] = []
  let cursor: string | null = null

  for (let i = 0; i < 3; i++) {
    const data: GQLReposResult = await githubGraphQL<GQLReposResult>(
      token,
      REPOS_QUERY,
      { first: 100, after: cursor },
    )
    for (const node of data.viewer.repositories.nodes) {
      if (
        node.viewerPermission
        && MAINTAINER_PERMS.has(node.viewerPermission)
        && SAFE_REPO_NAME.test(node.nameWithOwner)
      ) {
        repos.push(node.nameWithOwner)
      }
    }
    if (!data.viewer.repositories.pageInfo.hasNextPage) break
    cursor = data.viewer.repositories.pageInfo.endCursor
  }

  return repos
}

function buildRepoScope(repos: string[]): string {
  return repos.map(r => `repo:${r}`).join(' ')
}

function escapeGQL(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildPulseQuery(scope: string, dates: string[]): string {
  const sinceStr = dates[0]
  const safeScope = escapeGQL(scope)
  const aliases: string[] = []

  for (let i = 0; i < dates.length; i++) {
    const range = `${dates[i]}..${dates[i]}`

    aliases.push(
      `inc_${i}: search(query: "${safeScope} created:${range}", type: ISSUE, first: 100) {
        issueCount
        nodes { ${ITEM_FIELDS} }
      }`,
    )

    aliases.push(
      `closed_${i}: search(query: "${safeScope} is:issue closed:${range}", type: ISSUE, first: 0) {
        issueCount
      }`,
    )

    aliases.push(
      `merged_${i}: search(query: "${safeScope} is:pr merged:${range}", type: ISSUE, first: 0) {
        issueCount
      }`,
    )
  }

  aliases.push(
    `detail_closed: search(query: "${safeScope} is:issue closed:>=${sinceStr}", type: ISSUE, first: 100) {
      nodes { ${ITEM_FIELDS} }
    }`,
  )
  aliases.push(
    `detail_merged: search(query: "${safeScope} is:pr merged:>=${sinceStr}", type: ISSUE, first: 100) {
      nodes { ${ITEM_FIELDS} }
    }`,
  )

  return `query Pulse { ${aliases.join('\n')} }`
}

function toItem(node: GQLItemNode): PulseItem | null {
  if (!node.title || !node.number || !node.url || !node.repository) return null
  return {
    title: node.title,
    number: node.number,
    repo: node.repository.nameWithOwner,
    url: node.url,
    type: node.__typename === 'PullRequest' ? 'pr' : 'issue',
  }
}

function bucketDate(dateStr: string): string {
  return dateStr.slice(0, 10)
}

function utcDates(daysBack: number): string[] {
  const now = new Date()
  const dates: string[] = []
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

const CACHE_MAX_AGE = 60 * 5

const fetchPulse = defineCachedFunction(
  async (token: string, _login: string): Promise<PulseResponse> => {
    const dates = utcDates(6)

    const repos = await fetchMaintainedRepos(token)

    if (repos.length === 0) {
      return {
        days: [],
        totals: { incoming: 0, issuesClosed: 0, prsMerged: 0, resolved: 0, ratio: 0 },
      }
    }

    const scope = buildRepoScope(repos)
    const query = buildPulseQuery(scope, dates)

    const data = await githubGraphQL<Record<string, GQLSearchAlias>>(token, query)

    // Build resolved detail items lookup by date
    const resolvedItemsByDate = new Map<string, PulseItem[]>()
    for (const node of (data.detail_closed?.nodes ?? [])) {
      if (!node.closedAt) continue
      const key = bucketDate(node.closedAt)
      const item = toItem(node)
      if (!item) continue
      const arr = resolvedItemsByDate.get(key)
      if (arr) arr.push(item)
      else resolvedItemsByDate.set(key, [item])
    }
    for (const node of (data.detail_merged?.nodes ?? [])) {
      if (!node.mergedAt) continue
      const key = bucketDate(node.mergedAt)
      const item = toItem(node)
      if (!item) continue
      const arr = resolvedItemsByDate.get(key)
      if (arr) arr.push(item)
      else resolvedItemsByDate.set(key, [item])
    }

    // Build incoming detail items by date from per-day aliases
    const incomingItemsByDate = new Map<string, PulseItem[]>()
    for (const [i, date] of dates.entries()) {
      const nodes = data[`inc_${i}`]?.nodes ?? []
      const items: PulseItem[] = []
      for (const node of nodes) {
        const item = toItem(node)
        if (item) items.push(item)
      }
      if (items.length > 0) incomingItemsByDate.set(date, items)
    }

    // Assemble days with exact counts from issueCount
    const days: PulseDay[] = []
    let totalIncoming = 0
    let totalIssuesClosed = 0
    let totalPrsMerged = 0

    for (const [i, date] of dates.entries()) {
      const incoming = data[`inc_${i}`]?.issueCount ?? 0
      const closed = data[`closed_${i}`]?.issueCount ?? 0
      const merged = data[`merged_${i}`]?.issueCount ?? 0
      const resolved = closed + merged

      totalIncoming += incoming
      totalIssuesClosed += closed
      totalPrsMerged += merged

      days.push({
        date,
        incoming,
        resolved,
        incomingItems: incomingItemsByDate.get(date) ?? [],
        resolvedItems: resolvedItemsByDate.get(date) ?? [],
      })
    }

    const totalResolved = totalIssuesClosed + totalPrsMerged

    return {
      days,
      totals: {
        incoming: totalIncoming,
        issuesClosed: totalIssuesClosed,
        prsMerged: totalPrsMerged,
        resolved: totalResolved,
        ratio: totalIncoming > 0 ? Math.round((totalResolved / totalIncoming) * 100) / 100 : 0,
      },
    }
  },
  {
    maxAge: CACHE_MAX_AGE,
    name: 'pulse',
    getKey: (_token: string, login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  return fetchPulse(token, login)
})
