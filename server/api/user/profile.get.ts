const fetchOtherProfile = defineCachedFunction(
  async (token: string, userId: number, login: string): Promise<GitHubProfile> => {
    const { data } = await githubCachedFetchWithToken<GitHubUser>(token, userId, `/users/${login}`)
    return toProfile(data)
  },
  {
    maxAge: 60 * 15, // 15 minutes
    name: 'user-profile',
    getKey: (_token: string, _userId: number, login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const { token, userId } = await getSessionToken(event)
  const login = getQuery(event).login as string | undefined

  if (login) {
    return fetchOtherProfile(token, userId, login)
  }

  // Own profile — no cache (editable via PATCH)
  const { data } = await githubCachedFetchWithToken<GitHubUser>(token, userId, '/user')
  return toProfile(data)
})
