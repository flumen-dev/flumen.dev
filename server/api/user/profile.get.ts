import type { GitHubProfile } from '~~/shared/types/profile'

export default defineEventHandler(async (event) => {
  const { token, userId } = await getSessionToken(event)

  const storage = useStorage('data')
  const cacheKey = `users:${userId}:profile`
  const cached = await storage.getItem<GitHubProfile>(cacheKey)
  if (cached) return cached

  const { data } = await githubFetchWithToken<GitHubUser>(token, '/user')
  const profile = toProfile(data)
  await storage.setItem(cacheKey, profile)

  return profile
})
