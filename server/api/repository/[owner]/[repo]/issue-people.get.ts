interface Person {
  login: string
  avatarUrl: string
  name: string | null
  count: number
}

interface IssuePeopleResponse {
  authors: Person[]
  assignees: Person[]
}

const PEOPLE_QUERY = `
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    issues(first: 100, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        author { ... on User { login avatarUrl name } ... on Bot { login avatarUrl } }
        assignees(first: 10) { nodes { login avatarUrl name } }
      }
    }
  }
}
`

interface PeopleQueryResponse {
  repository: {
    issues: {
      pageInfo: { hasNextPage: boolean, endCursor: string | null }
      nodes: Array<{
        author: { login: string, avatarUrl: string, name?: string | null } | null
        assignees: { nodes: Array<{ login: string, avatarUrl: string, name?: string | null }> }
      }>
    } | null
  } | null
}

const MAX_PAGES = 5 // up to 500 issues sampled — enough to surface the active community

const fetchIssuePeople = defineCachedFunction(
  async (token: string, _login: string, userId: number, owner: string, repo: string): Promise<IssuePeopleResponse> => {
    const authors = new Map<string, Person>()
    const assignees = new Map<string, Person>()
    let cursor: string | null = null

    for (let page = 0; page < MAX_PAGES; page++) {
      const data: PeopleQueryResponse = await githubGraphQL(
        token,
        PEOPLE_QUERY,
        { owner, repo, cursor },
        userId,
      )
      const issues = data.repository?.issues
      if (!issues) break

      for (const node of issues.nodes) {
        if (node.author?.login) {
          const existing = authors.get(node.author.login)
          if (existing) existing.count++
          else authors.set(node.author.login, { login: node.author.login, avatarUrl: node.author.avatarUrl, name: node.author.name ?? null, count: 1 })
        }
        for (const a of node.assignees.nodes) {
          const existing = assignees.get(a.login)
          if (existing) existing.count++
          else assignees.set(a.login, { login: a.login, avatarUrl: a.avatarUrl, name: a.name ?? null, count: 1 })
        }
      }

      if (!issues.pageInfo.hasNextPage) break
      cursor = issues.pageInfo.endCursor
    }

    const sortByCount = (a: Person, b: Person) => b.count - a.count

    return {
      authors: [...authors.values()].sort(sortByCount),
      assignees: [...assignees.values()].sort(sortByCount),
    }
  },
  {
    name: 'issue-people',
    getKey: (_token: string, login: string, _userId: number, owner: string, repo: string) => `${login}:${owner}/${repo}`,
    maxAge: 60 * 30,
  },
)

export default defineEventHandler(async (event): Promise<IssuePeopleResponse> => {
  const { token, login, userId } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  return fetchIssuePeople(token, login, userId, owner, repo)
})
