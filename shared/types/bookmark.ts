export type BookmarkType = 'issue' | 'pr' | 'repo'

export interface Bookmark {
  type: BookmarkType
  /** Stable identifier, e.g. `issue:owner/repo#123` or `repo:owner/name`. */
  id: string
  title: string
  /** `owner/name` for issue/pr, identical to title for repo. */
  repo?: string
  number?: number
  /** Internal app path. */
  url: string
  /** Optional avatar (repo owner / issue author / etc). */
  avatarUrl?: string
  addedAt: number
}

export const BOOKMARKS_CAP = 200

export function bookmarkId(type: BookmarkType, repo: string, number?: number): string {
  if (type === 'repo') return `repo:${repo}`
  return `${type}:${repo}#${number}`
}
