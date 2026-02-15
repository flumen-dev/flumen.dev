const CREATE_ISSUE = `
mutation($repositoryId: ID!, $title: String!, $body: String) {
  createIssue(input: { repositoryId: $repositoryId, title: $title, body: $body }) {
    issue {
      id
      number
      title
      url
      state
      createdAt
    }
  }
}
`

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { repositoryId, title, body } = await readBody<{
    repositoryId: string
    title: string
    body?: string
  }>(event)

  if (typeof repositoryId !== 'string' || typeof title !== 'string' || !repositoryId || !title.trim()) {
    throw createError({ statusCode: 400, message: 'Missing repositoryId or title' })
  }

  const result = await githubGraphQL<{
    createIssue: {
      issue: {
        id: string
        number: number
        title: string
        url: string
        state: string
        createdAt: string
      }
    }
  }>(token, CREATE_ISSUE, {
    repositoryId,
    title: title.trim(),
    body: body?.trim() || undefined,
  })

  return result.createIssue.issue
})
