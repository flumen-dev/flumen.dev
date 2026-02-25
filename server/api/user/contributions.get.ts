interface ContributionDay {
  contributionCount: number
  date: string
}

interface ContributionWeek {
  contributionDays: ContributionDay[]
}

interface ContributionsResponse {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number
        weeks: ContributionWeek[]
      }
    }
  }
}

const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
  }
}
`

const fetchContributions = defineCachedFunction(
  async (token: string, login: string) => {
    const data = await githubGraphQL<ContributionsResponse>(token, QUERY, { login })
    if (!data.user) {
      throw createError({ statusCode: 404, message: `User '${login}' not found` })
    }
    const calendar = data.user.contributionsCollection.contributionCalendar

    return {
      totalContributions: calendar.totalContributions,
      weeks: calendar.weeks.map(w => w.contributionDays.map(d => ({
        date: d.date,
        count: d.contributionCount,
      }))),
    }
  },
  {
    maxAge: 60 * 30,
    name: 'user-contributions',
    getKey: (_token: string, login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login: sessionLogin } = await getSessionToken(event)
  const login = (getQuery(event).login as string) || sessionLogin

  return fetchContributions(token, login)
})
