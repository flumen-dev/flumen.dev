import { getRepoParams, getSessionToken, githubFetchWithToken } from '~~/server/utils/github'

export interface PendingBranch {
  branch: string
  aheadBy: number
  defaultBranch: string
}

interface GitHubBranch {
  name: string
  protected: boolean
}

export default defineEventHandler(async (event): Promise<PendingBranch[]> => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)

  // 1. Get repo info + branches
  const [{ data: repoData }, { data: branches }] = await Promise.all([
    githubFetchWithToken<{ default_branch: string }>(token, `/repos/${owner}/${repo}`),
    githubFetchWithToken<GitHubBranch[]>(token, `/repos/${owner}/${repo}/branches`, { params: { per_page: 100 } }),
  ])

  const defaultBranch = repoData.default_branch
  const candidateBranches = branches
    .filter(b => b.name !== defaultBranch && !b.protected)
    .map(b => b.name)

  if (!candidateBranches.length) return []

  // 2. Get all open PRs to exclude branches that already have one
  const { data: openPrs } = await githubFetchWithToken<{ head: { ref: string } }[]>(
    token, `/repos/${owner}/${repo}/pulls`, { params: { state: 'open', per_page: 100 } },
  )
  const prBranches = new Set(openPrs.map(pr => pr.head.ref))

  const withoutPr = candidateBranches.filter(b => !prBranches.has(b))
  if (!withoutPr.length) return []

  // 3. Check ahead count — only show branches with commits (limit to 5 to save API calls)
  const results: PendingBranch[] = []

  await Promise.allSettled(withoutPr.slice(0, 5).map(async (branch) => {
    const { data } = await githubFetchWithToken<{ ahead_by: number, commits: { author: { login: string } | null }[] }>(
      token, `/repos/${owner}/${repo}/compare/${encodeURIComponent(defaultBranch)}...${encodeURIComponent(branch)}`,
    )
    if (data.ahead_by === 0) return

    // Only show if the current user authored at least one commit
    const userCommitted = data.commits.some(c => c.author?.login === login)
    if (!userCommitted) return

    results.push({ branch, aheadBy: data.ahead_by, defaultBranch })
  }))

  return results
})
