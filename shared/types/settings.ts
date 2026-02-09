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
  { name: 'red', class: 'bg-red-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'amber', class: 'bg-amber-500' },
  { name: 'emerald', class: 'bg-emerald-500' },
  { name: 'cyan', class: 'bg-cyan-500' },
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'violet', class: 'bg-violet-500' },
  { name: 'rose', class: 'bg-rose-500' },
] as const
