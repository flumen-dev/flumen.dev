import type { RepoActivity } from '~~/shared/types/repository'

interface GitHubEvent {
  type: string
  repo: { name: string }
  created_at: string
  payload: { size?: number }
}

const WEEKS = 12

const fetchActivity = defineCachedFunction(
  async (login: string, token: string) => {
    const { data: events } = await githubFetchAllWithToken<GitHubEvent>(
      token,
      `/users/${login}/events`,
    )

    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const cutoff = now - WEEKS * weekMs
    const result: Record<string, RepoActivity> = {}

    for (const ev of events) {
      if (ev.type !== 'PushEvent') continue
      const ts = new Date(ev.created_at).getTime()
      if (ts < cutoff) continue

      const bucket = WEEKS - 1 - Math.floor((now - ts) / weekMs)
      if (!result[ev.repo.name]) {
        result[ev.repo.name] = { weeks: Array.from({ length: WEEKS }, () => 0) }
      }
      const entry = result[ev.repo.name]!
      entry.weeks[bucket] = (entry.weeks[bucket] ?? 0) + (ev.payload.size || 1)
    }

    return result
  },
  { maxAge: 3600, name: 'repo-activity', getKey: (login: string) => login },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  return fetchActivity(login, token)
})
