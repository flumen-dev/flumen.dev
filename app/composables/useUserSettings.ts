import type { UserSettings } from '~~/shared/types/settings'

export function useUserSettings() {
  const appConfig = useAppConfig()
  const settings = useState<UserSettings>('user-settings')

  async function load() {
    const data = await $fetch<UserSettings>('/api/user/settings')
    settings.value = data
    appConfig.ui.colors.primary = data.primaryColor
  }

  async function update(patch: Partial<UserSettings>) {
    const updated = await $fetch<UserSettings>('/api/user/settings', {
      method: 'PUT',
      body: patch,
    })
    settings.value = updated
    appConfig.ui.colors.primary = updated.primaryColor
  }

  return { settings, load, update }
}
