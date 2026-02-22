const CLEAR_STATUS_MUTATION = `
mutation {
  changeUserStatus(input: {}) {
    status {
      emoji
      message
    }
  }
}
`

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)

  await githubGraphQL(token, CLEAR_STATUS_MUTATION)

  return { cleared: true }
})
