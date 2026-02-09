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

export const accentColors = [
  { name: 'red', hex: '#ef4444' },
  { name: 'orange', hex: '#f97316' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'emerald', hex: '#10b981' },
  { name: 'cyan', hex: '#06b6d4' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'violet', hex: '#8b5cf6' },
  { name: 'rose', hex: '#f43f5e' },
] as const
