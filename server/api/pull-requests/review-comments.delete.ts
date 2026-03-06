import { getSessionToken, invalidateWorkItemDetailCache } from '~~/server/utils/github'

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { commentId, owner, repo, workItemId } = await readBody<{
    commentId: number
    owner: string
    repo: string
    workItemId?: string
  }>(event)

  if (!owner || !repo) {
    throw createError({ statusCode: 400, message: 'Missing owner or repo' })
  }
  if (!Number.isInteger(commentId) || commentId <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid commentId' })
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw createError({ statusCode: response.status, message: `GitHub API ${response.status}: ${response.statusText}` })
  }

  if (workItemId) {
    await invalidateWorkItemDetailCache(login, owner, repo, workItemId)
  }

  return { ok: true }
})
