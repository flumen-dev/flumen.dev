interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  stargazers_count: number
  language: string | null
  fork: boolean
}

const fetchOtherProfile = defineCachedFunction(
  async (token: string, userId: number, login: string) => {
    const [{ data: user }, { data: repos }] = await Promise.all([
      githubCachedFetchWithToken<GitHubUser>(token, userId, `/users/${login}`),
      githubCachedFetchWithToken<GitHubRepo[]>(token, userId, `/users/${login}/repos`, {
        params: { sort: 'stars', per_page: 6, type: 'owner' },
      }),
    ])

    return {
      ...toProfile(user),
      topRepos: repos.map(r => ({
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        stars: r.stargazers_count,
        language: r.language,
        fork: r.fork,
      })),
    }
  },
  {
    maxAge: 60 * 15,
    name: 'user-profile',
    getKey: (_token: string, _userId: number, login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const { token, userId } = await getSessionToken(event)
  const login = (getQuery(event).login as string | undefined)?.trim()

  if (login) {
    if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(login)) {
      throw createError({ statusCode: 400, message: 'Invalid GitHub username' })
    }
    return fetchOtherProfile(token, userId, login)
  }

  // Own profile — no cache (editable via PATCH)
  const { data } = await githubCachedFetchWithToken<GitHubUser>(token, userId, '/user')
  return toProfile(data)
})
