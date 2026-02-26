import { mapGitHubStatus, type GitHubStatusFields } from '~~/shared/types/status'

interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  stargazers_count: number
  language: string | null
  fork: boolean
}

const PROFILE_GQL = `
query($login: String!) {
  user(login: $login) {
    pronouns
    status {
      emoji
      message
      indicatesLimitedAvailability
      expiresAt
    }
  }
}
`

interface ProfileGQLResponse {
  user: {
    pronouns: string | null
    status: GitHubStatusFields | null
  } | null
}

const fetchOtherProfile = defineCachedFunction(
  async (token: string, userId: number, login: string) => {
    const [{ data: user }, { data: repos }, gql] = await Promise.all([
      githubCachedFetchWithToken<GitHubUser>(token, userId, `/users/${login}`),
      githubCachedFetchWithToken<GitHubRepo[]>(token, userId, `/users/${login}/repos`, {
        params: { sort: 'stars', per_page: 6, type: 'owner' },
      }),
      githubGraphQL<ProfileGQLResponse>(token, PROFILE_GQL, { login }),
    ])

    const profile = toProfile(user)
    if (gql.user?.pronouns) profile.pronouns = gql.user.pronouns

    return {
      ...profile,
      status: mapGitHubStatus(gql.user?.status ?? null),
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

  if (getQuery(event).login) {
    return fetchOtherProfile(token, userId, getLoginQuery(event))
  }

  // Own profile — no cache (editable via PATCH)
  const { data } = await githubCachedFetchWithToken<GitHubUser>(token, userId, '/user')
  return toProfile(data)
})
