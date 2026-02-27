export interface GitHubProfile {
  login: string
  name: string | null
  avatarUrl: string
  pronouns: string | null
  bio: string | null
  company: string | null
  location: string | null
  blog: string | null
  twitterUsername: string | null
  email: string | null
  hireable: boolean | null
  followers: number
  following: number
  publicRepos: number
  createdAt: string
}

export interface ProfileRepo {
  name: string
  fullName: string
  description: string | null
  stars: number
  language: string | null
  fork: boolean
}

export interface ProfilePin extends ProfileRepo {
  id: string // GraphQL node ID (needed for pin/unpin mutations)
}

export interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
  visibility: 'public' | 'private' | null
}
