export interface GitHubProfile {
  login: string
  name: string | null
  avatarUrl: string
  bio: string | null
  company: string | null
  location: string | null
  blog: string | null
  twitterUsername: string | null
  email: string | null
  hireable: boolean | null
}

export interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
  visibility: 'public' | 'private' | null
}
