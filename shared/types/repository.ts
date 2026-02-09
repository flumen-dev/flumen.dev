// #region GitHub API endpoint interfaces
export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  language: string | null
  visibility: 'public' | 'private' | 'internal'
  default_branch: string
  topics: string[]
  owner: { login: string, avatar_url: string }
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  watchers_count: number
  fork: boolean
  archived: boolean
  is_template: boolean
  created_at: string
  updated_at: string
  pushed_at: string
}
// #endregion

export interface Repository {
  id: number
  name: string
  fullName: string
  description: string | null
  htmlUrl: string
  language: string | null
  visibility: 'public' | 'private' | 'internal'
  defaultBranch: string
  topics: string[]

  owner: {
    login: string
    avatarUrl: string
  }

  stargazersCount: number
  forksCount: number
  openIssuesCount: number
  watchersCount: number

  fork: boolean
  archived: boolean
  isTemplate: boolean

  createdAt: string
  updatedAt: string
  pushedAt: string
}

/** Weekly commit counts per repo, keyed by repo fullName */
export interface RepoActivity {
  /** 12 weeks of commit counts (oldest → newest) */
  weeks: number[]
}

// #region Issue types
export interface GitHubIssue {
  id: number
  number: number
  title: string
  state: string
  html_url: string
  comments: number
  created_at: string
  updated_at: string
  user: { login: string, avatar_url: string }
  labels: Array<{ name: string, color: string }>
  assignees: Array<{ login: string, avatar_url: string }>
  milestone: { title: string } | null
}

export interface RepoIssue {
  id: number
  number: number
  title: string
  state: string
  htmlUrl: string
  comments: number
  createdAt: string
  updatedAt: string
  user: { login: string, avatarUrl: string }
  labels: Array<{ name: string, color: string }>
  assignees: Array<{ login: string, avatarUrl: string }>
  milestone: string | null
}
// #endregion

// #region Pull Request types
export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  state: string
  draft: boolean
  html_url: string
  comments: number
  created_at: string
  updated_at: string
  user: { login: string, avatar_url: string }
  labels: Array<{ name: string, color: string }>
  assignees: Array<{ login: string, avatar_url: string }>
  requested_reviewers: Array<{ login: string, avatar_url: string }>
  milestone: { title: string } | null
  head: { ref: string }
}

export interface RepoPullRequest {
  id: number
  number: number
  title: string
  state: string
  draft: boolean
  htmlUrl: string
  comments: number
  createdAt: string
  updatedAt: string
  user: { login: string, avatarUrl: string }
  labels: Array<{ name: string, color: string }>
  assignees: Array<{ login: string, avatarUrl: string }>
  requestedReviewers: Array<{ login: string, avatarUrl: string }>
  milestone: string | null
  headRef: string
}
// #endregion

// #region Notification types
export interface GitHubNotification {
  id: string
  reason: string
  updated_at: string
  repository: { full_name: string }
  subject: {
    title: string
    type: string
    url: string | null
  }
}

export interface RepoNotification {
  id: string
  reason: string
  updatedAt: string
  title: string
  type: string
  subjectUrl: string | null
}
// #endregion

export interface SearchResponse {
  total_count: number
  items: Array<{ repository_url: string }>
}
