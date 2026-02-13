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
  const { token } = await getSessionToken(event)
  const { subjectId, content, remove } = await readBody<{
    subjectId: string
    content: string
    remove: boolean
  }>(event)

  if (!subjectId || !content) {
    throw createError({ statusCode: 400, message: 'Missing subjectId or content' })
  }

  await githubGraphQL(token, remove ? REMOVE_REACTION : ADD_REACTION, {
    subjectId,
    content,
  })

  return { ok: true }
})
