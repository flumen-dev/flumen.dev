import { getRepoParams, getSessionToken, githubFetchWithToken, GitHubError, invalidateWorkItemDetailCache } from '~~/server/utils/github'

interface DismissRequest {
  message: string
  workItemId?: string
}

interface GitHubDismissResponse {
  id: number
  node_id: string
  state: string
}

const DISMISS_ERROR_MAP: Record<number, string> = {
  403: 'forbidden',
  404: 'notFound',
  422: 'validationFailed',
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const number = Number(getRouterParam(event, 'number'))
  const reviewId = Number(getRouterParam(event, 'reviewId'))

  if (!Number.isFinite(number) || number <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid pull request number' })
  }

  if (!Number.isFinite(reviewId) || reviewId <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid review ID' })
  }

  const body = await readBody<DismissRequest>(event)

  const trimmedMessage = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!trimmedMessage) {
    throw createError({ statusCode: 400, message: 'Dismiss message is required' })
  }

  try {
    const result = await githubFetchWithToken<GitHubDismissResponse>(
      token,
      `/repos/${owner}/${repo}/pulls/${number}/reviews/${reviewId}/dismissals`,
      { method: 'PUT', body: { message: trimmedMessage } },
    )

    if (body.workItemId) {
      await invalidateWorkItemDetailCache(login, owner, repo, body.workItemId)
    }

    return {
      id: result.data.node_id,
      state: result.data.state,
    }
  }
  catch (e) {
    const errorKey = e instanceof GitHubError ? DISMISS_ERROR_MAP[e.status] ?? 'unknown' : 'unknown'
    throw createError({
      statusCode: e instanceof GitHubError ? e.status : 500,
      data: { errorKey },
    })
  }
})
