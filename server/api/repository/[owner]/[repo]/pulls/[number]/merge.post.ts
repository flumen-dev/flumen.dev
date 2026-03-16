import type { MergeStrategy } from '~~/shared/types/merge'
import { getRepoParams, getSessionToken, githubFetchWithToken, GitHubError } from '~~/server/utils/github'

interface MergeRequest {
  strategy: MergeStrategy
  commitTitle?: string
  commitMessage?: string
  sha?: string
}

interface GitHubMergeResponse {
  sha: string
  merged: boolean
  message: string
}

const VALID_STRATEGIES: Set<string> = new Set(['merge', 'squash', 'rebase'])

// Map GitHub status codes to translatable error keys
const MERGE_ERROR_MAP: Record<number, string> = {
  403: 'forbidden',
  405: 'notMergeable',
  409: 'branchModified',
  422: 'validationFailed',
}

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const number = Number(getRouterParam(event, 'number'))

  if (!Number.isFinite(number) || number <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid pull request number' })
  }

  const body = await readBody<MergeRequest>(event)

  if (!body?.strategy || !VALID_STRATEGIES.has(body.strategy)) {
    throw createError({ statusCode: 400, message: 'Invalid merge strategy' })
  }

  const mergeBody: Record<string, string> = {
    merge_method: body.strategy,
  }

  if (body.commitTitle && body.strategy !== 'rebase') {
    mergeBody.commit_title = body.commitTitle
  }
  if (body.commitMessage && body.strategy !== 'rebase') {
    mergeBody.commit_message = body.commitMessage
  }
  if (body.sha) {
    mergeBody.sha = body.sha
  }

  try {
    const result = await githubFetchWithToken<GitHubMergeResponse>(
      token,
      `/repos/${owner}/${repo}/pulls/${number}/merge`,
      { method: 'PUT', body: mergeBody },
    )

    return {
      merged: result.data.merged,
      sha: result.data.sha,
    }
  }
  catch (e) {
    const errorKey = e instanceof GitHubError ? MERGE_ERROR_MAP[e.status] ?? 'unknown' : 'unknown'
    throw createError({
      statusCode: e instanceof GitHubError ? e.status : 500,
      data: { errorKey, message: e instanceof GitHubError ? e.message : undefined },
    })
  }
})
