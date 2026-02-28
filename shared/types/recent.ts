export type RecentItemType = 'issue' | 'pr'

export interface RecentItem {
  /** Unique key: `issue:owner/repo#123` or `pr:owner/repo#456` */
  key: string
  type: RecentItemType
  repo: string
  number: number
  title: string
  url: string
  /** When the user last visited this item */
  visitedAt: number
  /** When the item was last known to have changed (title, state, comments etc.) */
  updatedAt: number
  /** Previous title before a rename — shown until user visits the item */
  previousTitle?: string
  /** Optional: extra context for future use (comment anchor, label, etc.) */
  meta?: Record<string, unknown>
}

/** Result from the recent-sync server route */
export interface RecentSyncResult {
  key: string
  title: string
  updatedAt: string
}
