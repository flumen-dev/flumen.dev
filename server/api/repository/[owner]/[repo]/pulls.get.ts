const fetchRepoPulls = defineCachedFunction(
  async (login: string, token: string, owner: string, repo: string, state: 'open' | 'closed' | 'all', limit: number) => {
    const { data } = await githubFetchWithToken<GitHubPullRequest[]>(
      token,
      `/repos/${owner}/${repo}/pulls`,
      { params: { state, sort: 'updated', direction: 'desc', per_page: limit } },
    )
    return data.map(toRepoPullRequest)
  },
  {
    maxAge: 300,
    name: 'repo-detail-pulls',
    getKey: (login: string, _token: string, owner: string, repo: string, state: 'open' | 'closed' | 'all', limit: number) =>
      `${login}/${owner}/${repo}:${state}:${limit}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const query = getQuery(event)
  const stateParam = query.state
  const limitParam = Number(query.limit)

  const state: 'open' | 'closed' | 'all' = stateParam === 'closed' || stateParam === 'all' ? stateParam : 'open'
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(Math.floor(limitParam), 100)
    : 5

  return fetchRepoPulls(login, token, owner, repo, state, limit)
})
