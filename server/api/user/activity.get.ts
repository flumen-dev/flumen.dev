import type { GitHubEvent, UserActivityEvent } from '~~/server/utils/activity'
import { mapEvent } from '~~/server/utils/activity'

const fetchUserActivity = defineCachedFunction(
  async (token: string, login: string) => {
    const { data: events } = await githubFetchWithToken<GitHubEvent[]>(
      token,
      `/users/${login}/events/public`,
      { params: { per_page: 30 } },
    )

    const mapped: UserActivityEvent[] = []
    for (const ev of events) {
      const item = mapEvent(ev)
      if (item) mapped.push(item)
      if (mapped.length >= 10) break
    }

    return mapped
  },
  {
    maxAge: 60 * 5,
    name: 'user-activity',
    getKey: (_token: string, login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const login = getLoginQuery(event)
  return fetchUserActivity(token, login)
})
