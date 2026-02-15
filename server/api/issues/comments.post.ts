const ADD_COMMENT = `
mutation($subjectId: ID!, $body: String!) {
  addComment(input: { subjectId: $subjectId, body: $body }) {
    commentEdge {
      node {
        id
        body
        bodyHTML
        createdAt
        updatedAt
        authorAssociation
        author { login avatarUrl }
        reactionGroups {
          content
          viewerHasReacted
          reactors { totalCount }
        }
      }
    }
  }
}
`

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { subjectId, body, repo, issueNumber } = await readBody<{
    subjectId: string
    body: string
    repo: string
    issueNumber: number
  }>(event)

  if (!subjectId || !body?.trim()) {
    throw createError({ statusCode: 400, message: 'Missing subjectId or body' })
  }

  const result = await githubGraphQL<{
    addComment: {
      commentEdge: {
        node: {
          id: string
          body: string
          bodyHTML: string
          createdAt: string
          updatedAt: string
          authorAssociation: string
          author: { login: string, avatarUrl: string }
          reactionGroups: Array<{ content: string, viewerHasReacted: boolean, reactors: { totalCount: number } }>
        }
      }
    }
  }>(token, ADD_COMMENT, { subjectId, body })

  if (repo && issueNumber) {
    await invalidateIssueDetailCache(login, repo, issueNumber)
  }

  const node = result.addComment.commentEdge.node
  return {
    type: 'IssueComment' as const,
    id: node.id,
    body: node.body,
    bodyHTML: node.bodyHTML,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    authorAssociation: node.authorAssociation,
    author: node.author,
    reactionGroups: node.reactionGroups.map(r => ({
      content: r.content,
      count: r.reactors.totalCount,
      viewerHasReacted: r.viewerHasReacted,
    })),
  }
})
