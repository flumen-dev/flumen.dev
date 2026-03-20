import { getRepoParams, getSessionToken } from '~~/server/utils/github'
import { invalidateWorkItemDetailCache } from '~~/server/utils/repo-cache'

export default defineEventHandler(async (event) => {
  const { login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const id = getRouterParam(event, 'id')!

  await invalidateWorkItemDetailCache(login, owner, repo, id)
  return { invalidated: true }
})
