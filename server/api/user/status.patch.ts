import type { UserStatus } from '~~/shared/types/status'
import { shortcodeToUnicode } from '~~/shared/types/status'

const CHANGE_STATUS_MUTATION = `
mutation($input: ChangeUserStatusInput!) {
  changeUserStatus(input: $input) {
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
  const body = await readBody<{
    emoji?: string | null
    message?: string | null
    limitedAvailability?: boolean
    expiresAt?: string | null
  }>(event)

  const data = await githubGraphQL<{
    changeUserStatus: {
      status: {
        emoji: string | null
        message: string | null
        indicatesLimitedAvailability: boolean
        expiresAt: string | null
      }
    }
  }>(token, CHANGE_STATUS_MUTATION, {
    input: {
      emoji: body.emoji ?? null,
      message: body.message ?? null,
      limitedAvailability: body.limitedAvailability ?? false,
      expiresAt: body.expiresAt ?? null,
    },
  })

  const s = data.changeUserStatus.status

  return <UserStatus>{
    emoji: shortcodeToUnicode(s.emoji),
    message: s.message,
    limitedAvailability: s.indicatesLimitedAvailability,
    expiresAt: s.expiresAt,
  }
})
