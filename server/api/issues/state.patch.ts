import { invalidateIssueDetailCache, invalidateWorkItemDetailCache } from '~~/server/utils/github'

interface StateRequest {
  repo: string
  number: number
  state: 'open' | 'closed'
  stateReason?: 'completed' | 'not_planned' | 'reopened'
  workItemId?: string
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { repo, number, state, stateReason, workItemId } = await readBody<StateRequest>(event)

  if (!repo || !number || !state) {
    throw createError({ statusCode: 400, message: 'Missing repo, number, or state' })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw createError({ statusCode: 400, message: 'Invalid repo format' })
  }

  const body: Record<string, string> = { state }
  if (stateReason) body.state_reason = stateReason

  const res = await githubFetchWithToken<{ state: string, state_reason: string | null }>(
    token,
    `/repos/${owner}/${repoName}/issues/${number}`,
    { method: 'PATCH', body },
  )

  await invalidateIssueDetailCache(login, repo, number)
  if (workItemId) {
    await invalidateWorkItemDetailCache(login, owner, repoName, workItemId)
  }

  return { ok: true, state: res.data.state, stateReason: res.data.state_reason }
})
