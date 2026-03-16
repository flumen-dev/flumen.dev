import { getRepoParams, getSessionToken, invalidateWorkItemDetailCache } from '~~/server/utils/github'

export default defineEventHandler(async (event) => {
  const { login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const id = getRouterParam(event, 'id')!

  await invalidateWorkItemDetailCache(login, owner, repo, id)
  return { invalidated: true }
})
