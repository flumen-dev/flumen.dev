export interface CmdkRepo {
  id: string
  owner: string
  name: string
  fullName: string
  avatarUrl: string
  isPrivate: boolean
  isFork: boolean
  pushedAt: string | null
}

export type CmdkRecentItemType = 'repo' | 'issue' | 'pr' | 'user'

export interface CmdkRecentItem {
  type: CmdkRecentItemType
  id: string
  title: string
  subtitle?: string
  url: string
  avatarUrl?: string
  viewedAt: number
}

export const CMDK_RECENTS_CAP = 50

export type CmdkSearchScope = 'mine' | 'global'
export type CmdkSearchPrState = 'open' | 'closed' | 'merged' | 'draft'

interface CmdkSearchResultBase {
  id: string
  url: string
  ownerAvatarUrl: string
}

export interface CmdkSearchResultIssue extends CmdkSearchResultBase {
  kind: 'issue'
  number: number
  title: string
  state: 'open' | 'closed'
  repo: string
  updatedAt: string
}

export interface CmdkSearchResultPr extends CmdkSearchResultBase {
  kind: 'pr'
  number: number
  title: string
  state: CmdkSearchPrState
  repo: string
  updatedAt: string
}

export interface CmdkSearchResultRepo extends CmdkSearchResultBase {
  kind: 'repo'
  fullName: string
  description?: string
}

export type CmdkSearchResult = CmdkSearchResultIssue | CmdkSearchResultPr | CmdkSearchResultRepo

export interface CmdkSearchResponse {
  scope: CmdkSearchScope
  query: string
  results: CmdkSearchResult[]
}
