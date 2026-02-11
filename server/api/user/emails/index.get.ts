import type { GitHubEmail } from '~~/shared/types/profile'

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { data } = await githubFetchWithToken<GitHubEmail[]>(token, '/user/emails')
  return data
})
