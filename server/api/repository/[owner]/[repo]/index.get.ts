const fetchRepoDetail = defineCachedFunction(
  async (_login: string, token: string, userId: number, owner: string, repo: string) => {
    const { data } = await githubCachedFetchWithToken<GitHubRepoDetail>(
      token,
      userId,
      `/repos/${owner}/${repo}`,
    )
    return toRepoDetail(data)
  },
  { maxAge: 300, name: 'repo-detail', getKey: (_login: string, _token: string, _userId: number, owner: string, repo: string) => `${_login}/${owner}/${repo}` },
)

export default defineEventHandler(async (event) => {
  const { token, userId, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  return fetchRepoDetail(login, token, userId, owner, repo)
})
