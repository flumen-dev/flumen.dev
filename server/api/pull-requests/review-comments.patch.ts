import { getSessionToken, githubFetchWithToken, invalidateWorkItemDetailCache } from '~~/server/utils/github'

interface GitHubReviewCommentResponse {
  id: number
  node_id: string
  body: string
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { commentId, body, owner, repo, workItemId } = await readBody<{
    commentId: number
    body: string
    owner: string
    repo: string
    workItemId?: string
  }>(event)

  if (!body?.trim() || !owner || !repo) {
    throw createError({ statusCode: 400, message: 'Missing body, owner, or repo' })
  }
  if (!Number.isInteger(commentId) || commentId <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid commentId' })
  }

  const { data } = await githubFetchWithToken<GitHubReviewCommentResponse>(
    token,
    `/repos/${owner}/${repo}/pulls/comments/${commentId}`,
    { method: 'PATCH', body: { body } },
  )

  if (workItemId) {
    await invalidateWorkItemDetailCache(login, owner, repo, workItemId)
  }

  return {
    id: data.node_id,
    databaseId: data.id,
    body: data.body,
  }
})
