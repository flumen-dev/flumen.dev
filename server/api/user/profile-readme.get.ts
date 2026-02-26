interface GitHubContent {
  content: string
  sha: string
}

const fetchProfileReadme = defineCachedFunction(
  async (token: string, login: string) => {
    try {
      const { data } = await githubFetchWithToken<GitHubContent>(
        token,
        `/repos/${login}/${login}/contents/README.md`,
      )
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }
    catch (err) {
      if (err instanceof GitHubError && err.status === 404) {
        return null
      }
      throw err
    }
  },
  {
    maxAge: 60 * 15,
    name: 'user-profile-readme',
    getKey: (_token: string, login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const login = getLoginQuery(event)
  return { content: await fetchProfileReadme(token, login) }
})
