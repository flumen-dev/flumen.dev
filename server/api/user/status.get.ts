import type { UserStatus } from '~~/shared/types/status'
import { shortcodeToUnicode } from '~~/shared/types/status'

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
    viewer: {
      status: {
        emoji: string | null
        message: string | null
        indicatesLimitedAvailability: boolean
        expiresAt: string | null
      } | null
    }
  }>(token, STATUS_QUERY)

  const s = data.viewer.status

  return <UserStatus>{
    emoji: shortcodeToUnicode(s?.emoji ?? null),
    message: s?.message ?? null,
    limitedAvailability: s?.indicatesLimitedAvailability ?? false,
    expiresAt: s?.expiresAt ?? null,
  }
})
