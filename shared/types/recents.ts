export type RecentItemType = 'repo' | 'issue' | 'pr' | 'user'

export interface RecentItem {
  type: RecentItemType
  id: string
  title: string
  subtitle?: string
  url: string
  avatarUrl?: string
  viewedAt: number
}

export const RECENTS_CAP = 50
