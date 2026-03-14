import { getRepoWorkItemsForRequest } from '~~/server/utils/shared-repo-data'

export default defineEventHandler(async (event) => {
  const { owner, repo } = getRepoParams(event)
  const query = getQuery(event)
  const stateParam = query.state
  const limitParam = Number(query.limit)

  const state: 'open' | 'closed' | 'all' = stateParam === 'closed' || stateParam === 'all' ? stateParam : 'open'
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(Math.floor(limitParam), 100)
    : 30

  const allItems = await getRepoWorkItemsForRequest(event, owner, repo, state)
  return allItems.slice(0, limit)
})
