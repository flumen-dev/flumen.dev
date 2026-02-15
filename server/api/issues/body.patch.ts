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

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { id, body, repo, issueNumber } = await readBody<{
    id: string
    body: string
    repo: string
    issueNumber: number
  }>(event)

  if (!id || !body?.trim()) {
    throw createError({ statusCode: 400, message: 'Missing id or body' })
  }

  const result = await githubGraphQL<{
    updateIssue: {
      issue: {
        id: string
        body: string
        bodyHTML: string
        updatedAt: string
      }
    }
  }>(token, UPDATE_ISSUE_BODY, { id, body })

  if (repo && issueNumber) {
    await invalidateIssueDetailCache(login, repo, issueNumber)
  }

  return result.updateIssue.issue
})
