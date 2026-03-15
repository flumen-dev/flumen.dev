import { getRepoParams, getSessionToken, githubCachedFetchWithToken } from '~~/server/utils/github'

interface GitHubItem {
  updated_at: string
  state: string
}

export default defineEventHandler(async (event) => {
  const { token, userId, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const id = getRouterParam(event, 'id')!
  const { number } = parseWorkItemId(id)

  // Optional linked PR numbers (comma-separated) to also check
  const linkedPrs = (getQuery(event).prs as string || '')
    .split(',')
    .map(Number)
    .filter(n => Number.isFinite(n) && n > 0)

  // Check the issue/PR + all linked PRs via REST (ETags → 304 = free)
  const endpoints = [
    `/repos/${owner}/${repo}/issues/${number}`,
    ...linkedPrs.map(pr => `/repos/${owner}/${repo}/pulls/${pr}`),
  ]

  const results = await Promise.all(
    endpoints.map(ep => githubCachedFetchWithToken<GitHubItem>(token, userId, ep)),
  )

  const anyChanged = results.some(r => r.status !== 304)

  if (!anyChanged) {
    return { changed: false }
  }

  await invalidateWorkItemDetailCache(login, owner, repo, id)
  return { changed: true }
})
