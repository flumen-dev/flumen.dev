import { getRepoParams, getSessionToken, githubFetchWithToken, GitHubError, invalidateWorkItemDetailCache } from '~~/server/utils/github'

type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'

interface ReviewRequest {
  event: ReviewEvent
  body?: string
  workItemId?: string
}

interface GitHubReviewResponse {
  id: number
  node_id: string
  state: string
  body: string
  submitted_at: string
  user: { login: string, avatar_url: string }
}

const VALID_EVENTS: Set<string> = new Set(['APPROVE', 'REQUEST_CHANGES', 'COMMENT'])

const REVIEW_ERROR_MAP: Record<number, string> = {
  403: 'forbidden',
  404: 'notFound',
  422: 'validationFailed',
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const number = Number(getRouterParam(event, 'number'))

  if (!Number.isFinite(number) || number <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid pull request number' })
  }

  const body = await readBody<ReviewRequest>(event)

  if (!body?.event || !VALID_EVENTS.has(body.event)) {
    throw createError({ statusCode: 400, message: 'Invalid review event' })
  }

  const trimmedBody = typeof body.body === 'string' ? body.body.trim() : ''

  if (body.event === 'REQUEST_CHANGES' && !trimmedBody) {
    throw createError({ statusCode: 400, message: 'Body is required for REQUEST_CHANGES' })
  }

  const reviewBody: Record<string, string> = {
    event: body.event,
  }

  if (trimmedBody) {
    reviewBody.body = trimmedBody
  }

  try {
    const result = await githubFetchWithToken<GitHubReviewResponse>(
      token,
      `/repos/${owner}/${repo}/pulls/${number}/reviews`,
      { method: 'POST', body: reviewBody },
    )

    if (body.workItemId) {
      await invalidateWorkItemDetailCache(login, owner, repo, body.workItemId)
    }

    return {
      id: result.data.node_id,
      state: result.data.state,
      body: result.data.body,
      submittedAt: result.data.submitted_at,
      author: result.data.user.login,
      authorAvatarUrl: result.data.user.avatar_url,
    }
  }
  catch (e) {
    const errorKey = e instanceof GitHubError ? REVIEW_ERROR_MAP[e.status] ?? 'unknown' : 'unknown'
    throw createError({
      statusCode: e instanceof GitHubError ? e.status : 500,
      data: { errorKey },
    })
  }
})
