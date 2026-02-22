import type { GitHubContributor, GitHubRelease, RepoHealthStats } from '~~/shared/types/repository'

interface CommitActivity {
  total: number
  week: number
  days: number[]
}

const fetchRepoStats = defineCachedFunction(
  async (_login: string, token: string, owner: string, repo: string): Promise<RepoHealthStats> => {
    const [repoRes, releaseRes, contributorsRes, activityRes, prCountRes] = await Promise.allSettled([
      githubFetchWithToken<GitHubRepoDetail>(token, `/repos/${owner}/${repo}`),
      githubFetchWithToken<GitHubRelease>(token, `/repos/${owner}/${repo}/releases/latest`),
      githubFetchWithToken<GitHubContributor[]>(token, `/repos/${owner}/${repo}/contributors`, { params: { per_page: 10 } }),
      githubFetchWithToken<CommitActivity[]>(token, `/repos/${owner}/${repo}/stats/commit_activity`),
      githubFetchWithToken<{ total_count: number }>(token, `/search/issues`, { params: { q: `repo:${owner}/${repo} is:pr is:open`, per_page: 1 } }),
    ])

    const repoData = repoRes.status === 'fulfilled' ? repoRes.value.data : null
    const release = releaseRes.status === 'fulfilled' ? releaseRes.value.data : null
    const contributors = contributorsRes.status === 'fulfilled' ? contributorsRes.value : null
    const activity = activityRes.status === 'fulfilled' ? activityRes.value.data : null
    const prCount = prCountRes.status === 'fulfilled' ? prCountRes.value.data.total_count : 0

    // Parse total contributor count from Link header (last page)
    let contributorsCount = 0
    if (contributors) {
      const linkHeader = contributors.headers.get('link')
      if (linkHeader) {
        const lastMatch = linkHeader.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="last"/)
        contributorsCount = lastMatch ? Number(lastMatch[1]) * 10 : contributors.data.length
      }
      else {
        contributorsCount = contributors.data.length
      }
    }

    // Get last commit date from push timestamp
    const lastCommitDate = repoData?.pushed_at ?? null

    return {
      stars: repoData?.stargazers_count ?? 0,
      forks: repoData?.forks_count ?? 0,
      watchers: repoData?.subscribers_count ?? 0,
      openIssues: repoData?.open_issues_count ?? 0,
      openPrs: prCount,
      lastCommitDate,
      lastRelease: release ? toRepoRelease(release) : null,
      license: repoData?.license?.spdx_id ?? null,
      contributorsCount,
      topContributors: contributors?.data.map(toRepoContributor) ?? [],
      weeklyCommitActivity: Array.isArray(activity)
        ? activity.slice(-12).map(w => w.total)
        : [],
    }
  },
  { maxAge: 600, name: 'repo-stats', getKey: (_login: string, _token: string, owner: string, repo: string) => `${_login}/${owner}/${repo}` },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  return fetchRepoStats(login, token, owner, repo)
})
