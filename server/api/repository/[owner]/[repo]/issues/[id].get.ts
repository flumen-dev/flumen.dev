import type { IssueDetail } from '~~/shared/types/issue-detail'
import { getRepoParams } from '~~/server/utils/github'

export default defineEventHandler(async (event) => {
  const { owner, repo } = getRepoParams(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid issue number' })
  }

  return event.$fetch<IssueDetail>(`/api/issues/${id}`, {
    query: { repo: `${owner}/${repo}` },
  })
})
