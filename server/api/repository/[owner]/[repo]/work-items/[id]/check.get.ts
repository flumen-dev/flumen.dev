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

  // Check the issue/PR itself via REST (supports ETags → 304 = free)
  const main = await githubCachedFetchWithToken<GitHubItem>(
    token, userId, `/repos/${owner}/${repo}/issues/${number}`,
  )

  if (main.status === 304) {
    return { changed: false }
  }
  await invalidateWorkItemDetailCache(login, owner, repo, id)

  return { changed: true }
})
