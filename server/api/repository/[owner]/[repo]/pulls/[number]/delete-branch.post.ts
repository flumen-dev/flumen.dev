import { getRepoParams, getSessionToken } from '~~/server/utils/github'

interface DeleteBranchRequest {
  branch: string
  repo?: string
}

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)

  const body = await readBody<DeleteBranchRequest>(event)

  const branch = typeof body?.branch === 'string' ? body.branch.trim() : ''
  if (!branch) {
    throw createError({ statusCode: 400, message: 'Branch name is required' })
  }

  const targetRepo = body.repo || `${owner}/${repo}`

  try {
    const response = await fetch(
      `https://api.github.com/repos/${targetRepo}/git/refs/heads/${branch}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (response.status === 204 || response.status === 200) {
      return { deleted: true, branch }
    }

    const responseText = await response.text()

    if (response.status === 422) {
      const isRefMissing = responseText.includes('Reference does not exist')
        || responseText.includes('ref not found')
      if (isRefMissing) {
        return { deleted: true, branch }
      }
    }

    throw createError({
      statusCode: response.status,
      message: `Delete failed (${response.status}): ${responseText}`,
    })
  }
  catch (e) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw createError({ statusCode: 500, message: 'Failed to delete branch' })
  }
})
