const SEARCH_QUERY = /* GraphQL */ `
  query SearchRepos($q: String!) {
    search(query: $q, type: REPOSITORY, first: 10) {
      nodes {
        ... on Repository {
          databaseId
          nameWithOwner
          name
          owner { login }
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
  owner: { login: string }
  description: string | null
  primaryLanguage: { name: string } | null
  visibility: string
  openIssues: { totalCount: number }
  stargazerCount: number
  isFork: boolean
  viewerHasStarred: boolean
}

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const raw = getQuery<{ q?: string }>(event).q
  const q = raw?.trim()

  if (!q || q.length < 2) {
    return []
  }

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
      description: r.description,
      language: r.primaryLanguage?.name ?? null,
      visibility: r.visibility.toLowerCase(),
      openIssues: r.openIssues.totalCount,
      stars: r.stargazerCount,
      fork: r.isFork,
      starred: r.viewerHasStarred,
    }))
})
