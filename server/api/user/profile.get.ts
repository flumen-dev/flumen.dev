export default defineEventHandler(async (event) => {
  const { token, userId } = await getSessionToken(event)

  const { data } = await githubCachedFetchWithToken<GitHubUser>(token, userId, '/user')

  return toProfile(data)
})
