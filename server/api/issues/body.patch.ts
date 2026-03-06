const UPDATE_ISSUE_BODY = `
mutation($id: ID!, $body: String!) {
  updateIssue(input: { id: $id, body: $body }) {
    issue {
      id
      body
      bodyHTML
      updatedAt
    }
  }
}
`

const UPDATE_PULL_BODY = `
mutation($id: ID!, $body: String!) {
  updatePullRequest(input: { pullRequestId: $id, body: $body }) {
    pullRequest {
      id
      body
      bodyHTML
      updatedAt
    }
  }
}
`

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { id, body, repo, issueNumber, type, workItemId } = await readBody<{
    id: string
    body: string
    repo: string
    issueNumber: number
    type?: 'issue' | 'pull'
    workItemId?: string
  }>(event)

  if (!id || !body?.trim()) {
    throw createError({ statusCode: 400, message: 'Missing id or body' })
  }

  let result: { id: string, body: string, bodyHTML: string, updatedAt: string }

  if (type === 'pull') {
    const data = await githubGraphQL<{
      updatePullRequest: {
        pullRequest: {
          id: string
          body: string
          bodyHTML: string
          updatedAt: string
        }
      }
    }>(token, UPDATE_PULL_BODY, { id, body })
    result = data.updatePullRequest.pullRequest
  }
  else {
    const data = await githubGraphQL<{
      updateIssue: {
        issue: {
          id: string
          body: string
          bodyHTML: string
          updatedAt: string
        }
      }
    }>(token, UPDATE_ISSUE_BODY, { id, body })
    result = data.updateIssue.issue
  }

  if (repo && issueNumber) {
    await invalidateIssueDetailCache(login, repo, issueNumber)
  }

  if (workItemId) {
    const [owner, repoName] = (repo || '').split('/')
    if (owner && repoName) {
      await invalidateWorkItemDetailCache(login, owner, repoName, workItemId)
    }
  }

  return result
})
