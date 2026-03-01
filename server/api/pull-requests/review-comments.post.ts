import { getSessionToken, githubFetchWithToken, invalidateWorkItemDetailCache } from '~~/server/utils/github'

interface GitHubReviewCommentResponse {
  id: number
  node_id: string
  body: string
  path: string
  line: number | null
  created_at: string
  user: { login: string, avatar_url: string }
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { commentId, body, owner, repo, pullNumber, workItemId } = await readBody<{
    commentId: number
    body: string
    owner: string
    repo: string
    pullNumber: number
    workItemId: string
  }>(event)

  if (!commentId || !body?.trim() || !owner || !repo || !pullNumber) {
    throw createError({ statusCode: 400, message: 'Missing commentId, body, owner, repo, or pullNumber' })
  }

  const { data } = await githubFetchWithToken<GitHubReviewCommentResponse>(
    token,
    `/repos/${owner}/${repo}/pulls/${pullNumber}/comments/${commentId}/replies`,
    { method: 'POST', body: { body } },
  )

  if (workItemId) {
    await invalidateWorkItemDetailCache(login, owner, repo, workItemId)
  }

  return {
    id: data.node_id,
    body: data.body,
    path: data.path,
    line: data.line,
    createdAt: data.created_at,
    author: data.user.login,
    authorAvatarUrl: data.user.avatar_url,
  }
})
