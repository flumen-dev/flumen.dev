interface GitHubSocialAccount {
  provider: string
  url: string
}

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { data } = await githubFetchWithToken<GitHubSocialAccount[]>(token, '/user/social_accounts')
  return data
})
