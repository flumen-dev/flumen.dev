/**
 * Compact issue representation for inline expansion under a PR row. Lighter
 * than the full `Issue` type — just enough to render a one-line preview.
 */
export interface LinkedIssue {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  author: {
    login: string
    avatarUrl: string
  }
  repository: {
    nameWithOwner: string
  }
}
