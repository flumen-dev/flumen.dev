const DELETE_COMMENT = `
mutation($id: ID!) {
  deleteIssueComment(input: { id: $id }) {
    clientMutationId
  }
}
`

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { id, repo, issueNumber } = await readBody<{
    id: string
    repo: string
    issueNumber: number
  }>(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing comment id' })
  }

  await githubGraphQL(token, DELETE_COMMENT, { id })

  if (repo && issueNumber) {
    await invalidateIssueDetailCache(login, repo, issueNumber)
  }

  return { ok: true }
})
