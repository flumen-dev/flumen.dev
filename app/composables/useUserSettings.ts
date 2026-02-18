import { defaultUserSettings, type UserSettings } from '~~/shared/types/settings'
import type { UserOrg } from '~~/server/api/user/orgs.get'

export function useUserSettings() {
  const appConfig = useAppConfig()
  const settings = useState<UserSettings>('user-settings')
  const orgs = useState<UserOrg[]>('user-orgs', () => [])
  const { loggedIn } = useUserSession()

  async function load() {
    if (!loggedIn.value) {
      settings.value = defaultUserSettings
      orgs.value = []
      return
    }

    const [settingsResult, orgsResult] = await Promise.allSettled([
      $fetch<UserSettings>('/api/user/settings'),
      $fetch<UserOrg[]>('/api/user/orgs'),
    ])

    settings.value = settingsResult.status === 'fulfilled'
      ? settingsResult.value
      : defaultUserSettings
    appConfig.ui.colors.primary = settings.value.primaryColor

    orgs.value = orgsResult.status === 'fulfilled'
      ? orgsResult.value
      : []
  }

  async function update(patch: Partial<UserSettings>) {
    const updated = await $fetch<UserSettings>('/api/user/settings', {
      method: 'PUT',
      body: patch,
    })
    settings.value = updated
    appConfig.ui.colors.primary = updated.primaryColor
  }

  return { settings, orgs, load, update }
}
