import { getRepoDetailsForRequest } from '~~/server/utils/shared-repo-data'

export default defineEventHandler(async (event) => {
  const { owner, repo } = getRepoParams(event)
  return getRepoDetailsForRequest(event, owner, repo)
})
