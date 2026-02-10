const fetchRepoNotifications = defineCachedFunction(
  async (login: string, token: string, owner: string, repo: string) => {
    const { data } = await githubFetchAllWithToken<GitHubNotification>(
      token,
      `/repos/${owner}/${repo}/notifications`,
    )
    return data.map(toRepoNotification)
  },
  { maxAge: 120, name: 'repo-detail-notifications', getKey: (login: string, _token: string, owner: string, repo: string) => `${login}/${owner}/${repo}` },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  return fetchRepoNotifications(login, token, owner, repo)
})
