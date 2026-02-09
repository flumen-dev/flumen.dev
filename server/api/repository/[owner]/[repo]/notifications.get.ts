const fetchRepoNotifications = defineCachedFunction(
  async (token: string, owner: string, repo: string) => {
    const { data } = await githubFetchAllWithToken<GitHubNotification>(
      token,
      `/repos/${owner}/${repo}/notifications`,
    )
    return data.map(toRepoNotification)
  },
  { maxAge: 120, name: 'repo-detail-notifications', getKey: (_token: string, owner: string, repo: string) => `${owner}/${repo}` },
)

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  return fetchRepoNotifications(token, owner, repo)
})
