import { GitHubError, getRepoParams, getSessionToken } from '~~/server/utils/github'

const GITHUB_API = 'https://api.github.com'

const fetchJobLogs = defineCachedFunction(
  async (_login: string, token: string, owner: string, repo: string, jobId: number): Promise<string> => {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
      method: 'GET',
      headers: {
        Authorization: `bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new GitHubError(response.status, `/actions/jobs/${jobId}/logs`, `GitHub API ${response.status}`)
    }

    return await response.text()
  },
  {
    maxAge: 60 * 60 * 24,
    name: 'job-logs',
    getKey: (_login: string, _token: string, owner: string, repo: string, jobId: number) =>
      `${owner}/${repo}:${jobId}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const jobId = Number(getRouterParam(event, 'jobId'))

  if (!Number.isFinite(jobId) || jobId <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid job ID' })
  }

  return fetchJobLogs(login, token, owner, repo, jobId)
})
