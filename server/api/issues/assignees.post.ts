import { invalidateIssueDetailCache, invalidateWorkItemDetailCache } from '~~/server/utils/github'

interface AssigneeRequest {
  repo: string
  number: number
  action: 'add' | 'remove'
  login: string
  workItemId?: string
}

export default defineEventHandler(async (event) => {
  const { token, login: currentLogin } = await getSessionToken(event)
  const { repo, number, action, login, workItemId } = await readBody<AssigneeRequest>(event)

  if (!repo || !number || !login) {
    throw createError({ statusCode: 400, message: 'Missing repo, number, or login' })
  }

  if (action !== 'add' && action !== 'remove') {
    throw createError({ statusCode: 400, message: 'Invalid action' })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw createError({ statusCode: 400, message: 'Invalid repo format' })
  }

  if (action === 'remove') {
    await githubFetchWithToken(token, `/repos/${owner}/${repoName}/issues/${number}/assignees`, {
      method: 'DELETE',
      body: { assignees: [login] },
    })
  }
  else {
    await githubFetchWithToken(token, `/repos/${owner}/${repoName}/issues/${number}/assignees`, {
      method: 'POST',
      body: { assignees: [login] },
    })
  }

  await invalidateIssueDetailCache(currentLogin, repo, number)
  if (workItemId) {
    await invalidateWorkItemDetailCache(currentLogin, owner, repoName, workItemId)
  }

  return { ok: true }
})
