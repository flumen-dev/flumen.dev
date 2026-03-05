import type { RepoActivity } from '~~/shared/types/repository'

interface GitHubEvent {
  type: string
  repo: { name: string }
  created_at: string
  payload: { size?: number }
}

const ACTIVITY_WEEKS = 12

export const fetchRepoActivity = defineCachedFunction(
  async (login: string, token: string) => {
    const { data: events } = await githubFetchAllWithToken<GitHubEvent>(
      token,
      `/users/${login}/events`,
    )

    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const cutoff = now - ACTIVITY_WEEKS * weekMs
    const result: Record<string, RepoActivity> = {}

    for (const ev of events) {
      if (ev.type !== 'PushEvent') continue
      const ts = new Date(ev.created_at).getTime()
      if (ts < cutoff) continue

      const bucket = Math.min(ACTIVITY_WEEKS - 1, Math.max(0, ACTIVITY_WEEKS - 1 - Math.floor((now - ts) / weekMs)))
      if (!result[ev.repo.name]) {
        result[ev.repo.name] = { weeks: Array.from({ length: ACTIVITY_WEEKS }, () => 0) }
      }
      const entry = result[ev.repo.name]!
      entry.weeks[bucket] = (entry.weeks[bucket] ?? 0) + (ev.payload.size ?? 1)
    }

    return result
  },
  { maxAge: 3600, name: 'repo-activity', getKey: (login: string) => login },
)

export const fetchRepoNotifications = defineCachedFunction(
  async (_login: string, token: string) => {
    const { data } = await githubFetchAllWithToken<GitHubNotification>(
      token,
      '/notifications',
    )

    const counts: Record<string, number> = {}
    for (const n of data) {
      counts[n.repository.full_name] = (counts[n.repository.full_name] || 0) + 1
    }
    return counts
  },
  { maxAge: 120, name: 'repo-notifications', getKey: (login: string) => login },
)

export const fetchRepoCounts = defineCachedFunction(
  async (_cacheKey: string, token: string, repoList: Array<{ owner: string, name: string }>) => {
    return githubRepoCountsGraphQL(token, repoList)
  },
  { maxAge: 300, name: 'repo-counts', getKey: (cacheKey: string) => cacheKey },
)
