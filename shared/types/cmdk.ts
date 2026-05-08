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
