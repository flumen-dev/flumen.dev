import type { GitHubProfile } from '~~/shared/types/profile'

export default defineEventHandler(async (event) => {
  const { token, userId } = await getSessionToken(event)
  const body = await readBody<Partial<GitHubProfile>>(event)

  const { data } = await githubFetchWithToken<GitHubUser>(token, '/user', {
    method: 'PATCH',
    body: {
      name: body.name,
      bio: body.bio,
      company: body.company,
      location: body.location,
      blog: body.blog,
      twitter_username: body.twitterUsername,
      hireable: body.hireable,
    },
  })

  const profile = toProfile(data)
  const storage = useStorage('data')
  await storage.setItem(`users:${userId}:profile`, profile)

  return profile
})
