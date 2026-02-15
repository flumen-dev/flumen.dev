const ADD_REACTION = `
mutation($subjectId: ID!, $content: ReactionContent!) {
  addReaction(input: { subjectId: $subjectId, content: $content }) {
    reaction { content }
  }
}
`

const REMOVE_REACTION = `
mutation($subjectId: ID!, $content: ReactionContent!) {
  removeReaction(input: { subjectId: $subjectId, content: $content }) {
    reaction { content }
  }
}
`

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { subjectId, content, remove, repo, issueNumber } = await readBody<{
    subjectId: string
    content: string
    remove: boolean
    repo: string
    issueNumber: number
  }>(event)

  if (!subjectId || !content) {
    throw createError({ statusCode: 400, message: 'Missing subjectId or content' })
  }

  await githubGraphQL(token, remove ? REMOVE_REACTION : ADD_REACTION, {
    subjectId,
    content,
  })

  if (repo && issueNumber) {
    await invalidateIssueDetailCache(login, repo, issueNumber)
  }

  return { ok: true }
})
