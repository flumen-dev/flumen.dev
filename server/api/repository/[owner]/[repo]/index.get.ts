import { getRepoDetailsForRequest } from '~~/server/utils/repo-sync-service'

export default defineEventHandler(async (event) => {
  const { owner, repo } = getRepoParams(event)
  return getRepoDetailsForRequest(event, owner, repo)
})
