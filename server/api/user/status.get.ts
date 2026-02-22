import { mapGitHubStatus, type GitHubStatusFields } from '~~/shared/types/status'

const STATUS_QUERY = `
query {
  viewer {
    status {
      emoji
      message
      indicatesLimitedAvailability
      expiresAt
    }
  }
}
`

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)

  const data = await githubGraphQL<{
    viewer: { status: GitHubStatusFields | null }
  }>(token, STATUS_QUERY)

  return mapGitHubStatus(data.viewer.status)
})
