const SEARCH_QUERY = /* GraphQL */ `
  query SearchRepos($q: String!) {
    search(query: $q, type: REPOSITORY, first: 10) {
      nodes {
        ... on Repository {
          databaseId
          nameWithOwner
          name
          owner {
            login
            avatarUrl
          }
          description
          primaryLanguage { name }
          visibility
          openIssues: issues(states: OPEN) { totalCount }
          stargazerCount
          isFork
          viewerHasStarred
        }
      }
    }
  }
`

interface GQLRepoNode {
  databaseId: number
  nameWithOwner: string
  name: string
  owner: {
    login: string
    avatarUrl: string
  }
  description: string | null
  primaryLanguage: { name: string } | null
  visibility: string
  openIssues: { totalCount: number }
  stargazerCount: number
  isFork: boolean
  viewerHasStarred: boolean
}

const fetchRepoSearchResults = defineCachedFunction(
  async (_login: string, token: string, q: string) => {
    const data = await githubGraphQL<{
      search: {
        nodes: (GQLRepoNode | null)[]
      }
    }>(token, SEARCH_QUERY, { q: `${q} sort:stars-desc` })

    return data.search.nodes
      .filter((n): n is GQLRepoNode => n !== null && 'databaseId' in n)
      .map(r => ({
        id: r.databaseId,
        fullName: r.nameWithOwner,
        name: r.name,
        owner: r.owner.login,
        ownerAvatarUrl: r.owner.avatarUrl,
        description: r.description,
        language: r.primaryLanguage?.name ?? null,
        visibility: r.visibility.toLowerCase(),
        openIssues: r.openIssues.totalCount,
        stars: r.stargazerCount,
        fork: r.isFork,
        starred: r.viewerHasStarred,
      }))
  },
  {
    maxAge: 90,
    name: 'repo-search',
    getKey: (login: string, _token: string, q: string) => `${login}:${q.toLowerCase()}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const raw = getQuery<{ q?: string }>(event).q
  const q = raw?.trim().replace(/\s+/g, ' ')

  if (!q || q.length < 2) {
    return []
  }

  return fetchRepoSearchResults(login, token, q.slice(0, 100))
})
