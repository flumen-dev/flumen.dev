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
