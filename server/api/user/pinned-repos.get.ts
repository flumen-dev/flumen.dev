import type { ProfilePin } from '~~/shared/types/profile'

const PINNED_REPOS_GQL = `
query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          id
          name
          nameWithOwner
          description
          stargazerCount
          primaryLanguage { name }
          isFork
        }
      }
    }
  }
}
`

interface GQLRepo {
  id: string
  name: string
  nameWithOwner: string
  description: string | null
  stargazerCount: number
  primaryLanguage: { name: string } | null
  isFork: boolean
}

interface PinnedReposGQLResponse {
  user: {
    pinnedItems: { nodes: GQLRepo[] }
  }
}

function mapRepo(r: GQLRepo): ProfilePin {
  return {
    id: r.id,
    name: r.name,
    fullName: r.nameWithOwner,
    description: r.description,
    stars: r.stargazerCount,
    language: r.primaryLanguage?.name ?? null,
    fork: r.isFork,
  }
}

const fetchPinnedRepos = defineCachedFunction(
  async (token: string, login: string) => {
    const data = await githubGraphQL<PinnedReposGQLResponse>(token, PINNED_REPOS_GQL, { login })
    return data.user.pinnedItems.nodes.map(mapRepo)
  },
  {
    maxAge: 60 * 20,
    name: 'pinned-repos',
    getKey: (_token: string, login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const login = getLoginQuery(event)
  const pinned = await fetchPinnedRepos(token, login)

  return { pinned }
})
