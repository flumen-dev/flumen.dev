const fetchRepoPulls = defineCachedFunction(
  async (login: string, token: string, owner: string, repo: string) => {
    const { data } = await githubFetchWithToken<GitHubPullRequest[]>(
      token,
      `/repos/${owner}/${repo}/pulls`,
      { params: { state: 'open', sort: 'updated', direction: 'desc', per_page: 5 } },
    )
    return data.map(toRepoPullRequest)
  },
  { maxAge: 300, name: 'repo-detail-pulls', getKey: (login: string, _token: string, owner: string, repo: string) => `${login}/${owner}/${repo}` },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  return fetchRepoPulls(login, token, owner, repo)
})
