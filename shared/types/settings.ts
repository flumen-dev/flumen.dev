export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  primaryColor: string
  locale: string
}

export const defaultUserSettings: UserSettings = {
  theme: 'system',
  primaryColor: 'indigo',
  locale: 'en',
}
