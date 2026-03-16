import { getSessionToken, githubFetchWithToken } from '~~/server/utils/github'

interface CreatePrRequest {
  repo: string
  head: string
  base: string
  title: string
  body: string
  draft?: boolean
  workItemId?: string
}

interface GitHubPrResponse {
  number: number
  html_url: string
  node_id: string
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const input = await readBody<CreatePrRequest>(event)

  if (!input?.repo || !input.head || !input.base || !input.title) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const [owner, repoName] = input.repo.split('/')
  if (!owner || !repoName) {
    throw createError({ statusCode: 400, message: 'Invalid repo format' })
  }

  // If head doesn't contain ":", it's a same-repo branch. For forks, prefix with user login.
  const head = input.head.includes(':') ? input.head : `${owner}:${input.head}`

  const { data } = await githubFetchWithToken<GitHubPrResponse>(token, `/repos/${owner}/${repoName}/pulls`, {
    method: 'POST',
    body: {
      title: input.title,
      body: input.body,
      head,
      base: input.base,
      draft: input.draft ?? false,
    },
  })

  // Invalidate work item cache so polling picks up the new PR
  if (input.workItemId) {
    await invalidateWorkItemDetailCache(login, owner, repoName, input.workItemId)
  }

  return {
    number: data.number,
    url: data.html_url,
    nodeId: data.node_id,
  }
})
