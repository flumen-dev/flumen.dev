interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  stargazers_count: number
  language: string | null
}

export interface SharedRepo {
  fullName: string
  description: string | null
  stars: number
  language: string | null
}

const fetchSharedRepos = defineCachedFunction(
  async (token: string, myLogin: string, otherLogin: string) => {
    const [{ data: myRepos }, { data: theirRepos }] = await Promise.all([
      githubFetchAllWithToken<GitHubRepo>(token, `/users/${myLogin}/repos`, {
        params: { per_page: 100, type: 'all' },
      }),
      githubFetchAllWithToken<GitHubRepo>(token, `/users/${otherLogin}/repos`, {
        params: { per_page: 100, type: 'all' },
      }),
    ])

    const myNames = new Set(myRepos.map(r => r.full_name))
    const shared: SharedRepo[] = []

    for (const repo of theirRepos) {
      if (myNames.has(repo.full_name)) {
        shared.push({
          fullName: repo.full_name,
          description: repo.description,
          stars: repo.stargazers_count,
          language: repo.language,
        })
      }
    }

    return shared.sort((a, b) => b.stars - a.stars).slice(0, 6)
  },
  {
    maxAge: 60 * 15,
    name: 'user-shared-repos',
    getKey: (_token: string, myLogin: string, otherLogin: string) => `${myLogin}:${otherLogin}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login: myLogin } = await getSessionToken(event)
  const otherLogin = getLoginQuery(event)

  if (otherLogin.toLowerCase() === myLogin.toLowerCase()) {
    return []
  }

  return fetchSharedRepos(token, myLogin, otherLogin)
})
