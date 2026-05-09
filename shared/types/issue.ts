import type { PageInfo } from './pagination'

export interface Issue {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  createdAt: string
  updatedAt: string
  closedAt: string | null

  author: {
    login: string
    avatarUrl: string
  }

  labels: Array<{
    name: string
    color: string
  }>

  assignees: Array<{
    login: string
    avatarUrl: string
  }>

  milestone: string | null
  commentCount: number
  linkedPrCount: number
  maintainerCommented: boolean

  /** The most recent comment, if any. Used for "needs response" signals and inline previews. */
  lastComment: {
    author: { login: string, avatarUrl: string }
    snippet: string
    createdAt: string
  } | null

  /**
   * Timestamp of the latest substantial timeline event (comment, state change,
   * assignment, cross-reference, etc.). Excludes label and milestone changes
   * so bot-driven re-tagging doesn't bubble dead threads to the top.
   * Falls back to `null` when no such event exists — sort consumers should use
   * `lastSubstantialActivityAt ?? updatedAt`.
   */
  lastSubstantialActivityAt: string | null

  repository: {
    nameWithOwner: string
    name: string
    owner: string
  }
}

/** Shape returned by GitHub GraphQL search for issues */
export interface GraphQLIssueNode {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  author: { login: string, avatarUrl: string } | null
  labels: { nodes: Array<{ name: string, color: string }> }
  assignees: { nodes: Array<{ login: string, avatarUrl: string }> }
  milestone: { title: string } | null
  comments: {
    totalCount: number
    nodes: Array<{
      author: { login: string, avatarUrl: string } | null
      body: string
      createdAt: string
    }>
  }
  /** Aliased timelineItems for linked PR count (cross-references). */
  linkedPrs?: { totalCount: number }
  /** Aliased timelineItems for the latest substantial activity event. */
  substantialActivity?: {
    nodes: Array<{
      __typename: string
      createdAt: string
    }>
  }
  /** Legacy alias kept for cached entries written before the rename. */
  timelineItems?: { totalCount: number }
  repository: { nameWithOwner: string, name: string, owner: { login: string } }
}

export interface GraphQLIssueSearchResult {
  search: {
    issueCount: number
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | null
    }
    nodes: GraphQLIssueNode[]
  }
}

export interface PaginatedIssues {
  issues: Issue[]
  totalCount: number
  pageInfo: PageInfo
}

/** Minimal node returned by the lightweight search query (for cache lookups) */
export interface MinimalIssueNode {
  id: string
  number: number
  updatedAt: string
  repository: { nameWithOwner: string, name: string, owner: { login: string } }
}
