import type { GitHubProfile } from '~~/shared/types/profile'

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  bio: string | null
  company: string | null
  location: string | null
  blog: string | null
  twitter_username: string | null
  email: string | null
  hireable: boolean | null
}

export function toProfile(user: GitHubUser): GitHubProfile {
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    company: user.company,
    location: user.location,
    blog: user.blog,
    twitterUsername: user.twitter_username,
    email: user.email,
    hireable: user.hireable,
  }
}
