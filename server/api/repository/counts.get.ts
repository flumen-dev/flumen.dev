const fetchCounts = defineCachedFunction(
  async (_login: string, token: string) => {
    const { data: repos } = await githubFetchAllWithToken<GitHubRepo>(
      token,
      '/user/repos',
      { params: { per_page: 100 } },
    )

    const repoList = repos.map(r => ({
      owner: r.owner.login,
      name: r.name,
    }))

    return githubRepoCountsGraphQL(token, repoList)
  },
  { maxAge: 300, name: 'repo-counts', getKey: (login: string) => login },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  return fetchCounts(login, token)
})
