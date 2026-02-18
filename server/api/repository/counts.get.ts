const fetchCounts = defineCachedFunction(
  async (_cacheKey: string, token: string, org?: string) => {
    const endpoint = org ? `/orgs/${org}/repos` : '/user/repos'
    const { data: repos } = await githubFetchAllWithToken<GitHubRepo>(
      token,
      endpoint,
      { params: { per_page: 100 } },
    )

    const repoList = repos.map(r => ({
      owner: r.owner.login,
      name: r.name,
    }))

    return githubRepoCountsGraphQL(token, repoList)
  },
  { maxAge: 300, name: 'repo-counts', getKey: (cacheKey: string) => cacheKey },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const org = getOrgQuery(event)
  const cacheKey = org ? `${login}:${org}` : login
  return fetchCounts(cacheKey, token, org)
})
