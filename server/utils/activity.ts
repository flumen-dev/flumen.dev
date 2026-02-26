export interface GitHubEvent {
  type: string
  repo: { name: string }
  created_at: string
  payload: {
    action?: string
    ref?: string
    ref_type?: string
    size?: number
    pull_request?: { title: string, number: number }
    issue?: { title: string, number: number }
    release?: { tag_name: string }
  }
}

export type ActivityType = 'push' | 'pr' | 'issue' | 'create' | 'release' | 'star' | 'fork'

export interface UserActivityEvent {
  type: ActivityType
  repo: string
  action?: string
  title?: string
  number?: number
  ref?: string
  refType?: string
  tagName?: string
  createdAt: string
}

export function mapEvent(ev: GitHubEvent): UserActivityEvent | null {
  const base = { repo: ev.repo.name, createdAt: ev.created_at }

  switch (ev.type) {
    case 'PushEvent':
      return { ...base, type: 'push', ref: ev.payload.ref?.replace('refs/heads/', '') }
    case 'IssuesEvent':
      return { ...base, type: 'issue', action: ev.payload.action, title: ev.payload.issue?.title, number: ev.payload.issue?.number }
    case 'PullRequestEvent':
      return { ...base, type: 'pr', action: ev.payload.action, title: ev.payload.pull_request?.title, number: ev.payload.pull_request?.number }
    case 'CreateEvent':
      return { ...base, type: 'create', refType: ev.payload.ref_type, ref: ev.payload.ref ?? undefined }
    case 'ReleaseEvent':
      return { ...base, type: 'release', action: ev.payload.action, tagName: ev.payload.release?.tag_name }
    case 'WatchEvent':
      return { ...base, type: 'star' }
    case 'ForkEvent':
      return { ...base, type: 'fork' }
    default:
      return null
  }
}
