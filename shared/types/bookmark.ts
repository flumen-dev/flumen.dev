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

export function bookmarkId(type: 'repo', repo: string): string
export function bookmarkId(type: 'issue' | 'pr', repo: string, number: number): string
export function bookmarkId(type: BookmarkType, repo: string, number?: number): string {
  if (type === 'repo') return `repo:${repo}`
  if (number === undefined) {
    throw new Error(`bookmarkId: 'number' is required for type '${type}'`)
  }
  return `${type}:${repo}#${number}`
}
