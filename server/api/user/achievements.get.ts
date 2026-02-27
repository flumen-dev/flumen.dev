import type { Achievement } from '~~/shared/types/profile'

const fetchAchievements = defineCachedFunction(
  async (login: string): Promise<Achievement[]> => {
    try {
      const html = await $fetch<string>(`https://github.com/${login}?tab=achievements`, {
        headers: { Accept: 'text/html' },
      })

      return parseAchievements(html, login)
    }
    catch {
      return []
    }
  },
  {
    maxAge: 60 * 30, // 30 minutes
    name: 'user-achievements',
    getKey: (login: string) => login,
  },
)

export default defineEventHandler(async (event) => {
  const login = getLoginQuery(event)
  return fetchAchievements(login)
})
