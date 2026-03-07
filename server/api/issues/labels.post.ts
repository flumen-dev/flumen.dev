import { invalidateIssueDetailCache, invalidateWorkItemDetailCache } from '~~/server/utils/github'

interface LabelRequest {
  repo: string
  number: number
  action: 'add' | 'remove'
  label: string
  workItemId?: string
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { repo, number, action, label, workItemId } = await readBody<LabelRequest>(event)

  if (!repo || !number || !label) {
    throw createError({ statusCode: 400, message: 'Missing repo, number, or label' })
  }

  if (action !== 'add' && action !== 'remove') {
    throw createError({ statusCode: 400, message: 'Invalid action' })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw createError({ statusCode: 400, message: 'Invalid repo format' })
  }

  if (action === 'remove') {
    await githubFetchWithToken(token, `/repos/${owner}/${repoName}/issues/${number}/labels/${encodeURIComponent(label)}`, {
      method: 'DELETE',
    })
  }
  else {
    await githubFetchWithToken(token, `/repos/${owner}/${repoName}/issues/${number}/labels`, {
      method: 'POST',
      body: { labels: [label] },
    })
  }

  await invalidateIssueDetailCache(login, repo, number)
  if (workItemId) {
    await invalidateWorkItemDetailCache(login, owner, repoName, workItemId)
  }

  return { ok: true }
})
