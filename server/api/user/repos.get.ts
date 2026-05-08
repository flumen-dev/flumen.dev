const REPOS_GQL = `
query($cursor: String) {
  viewer {
    repositories(
      first: 100
      after: $cursor
      affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        nameWithOwner
        isPrivate
        isFork
        pushedAt
        owner { login avatarUrl }
      }
    }
  }
}
`

interface GQLRepoNode {
  id: string
  name: string
  nameWithOwner: string
  isPrivate: boolean
  isFork: boolean
  pushedAt: string | null
  owner: { login: string, avatarUrl: string }
}

interface ReposGQLResponse {
  viewer: {
    repositories: {
      pageInfo: { hasNextPage: boolean, endCursor: string | null }
      nodes: GQLRepoNode[]
    }
  }
}

const MAX_PAGES = 20

const fetchAllRepos = defineCachedFunction(
  async (token: string, _login: string, userId: number): Promise<CmdkRepo[]> => {
    const all: GQLRepoNode[] = []
    let cursor: string | null = null

    for (let page = 0; page < MAX_PAGES; page++) {
      const data: ReposGQLResponse = await githubGraphQL<ReposGQLResponse>(token, REPOS_GQL, { cursor }, userId)
      all.push(...data.viewer.repositories.nodes)
      if (!data.viewer.repositories.pageInfo.hasNextPage) break
      cursor = data.viewer.repositories.pageInfo.endCursor
    }

    return all.map(r => ({
      id: r.id,
      owner: r.owner.login,
      name: r.name,
      fullName: r.nameWithOwner,
      avatarUrl: r.owner.avatarUrl,
      isPrivate: r.isPrivate,
      isFork: r.isFork,
      pushedAt: r.pushedAt,
    }))
  },
  {
    maxAge: 60 * 10,
    name: 'cmdk-user-repos',
    getKey: (_token: string, login: string, _userId: number) => login,
  },
)

export default defineEventHandler(async (event): Promise<CmdkRepo[]> => {
  const { token, userId, login } = await getSessionToken(event)
  return fetchAllRepos(token, login, userId)
})
