/**
 * REST-based reaction endpoint — fallback for orgs that block OAuth App GraphQL access.
 * Uses: POST /repos/{owner}/{repo}/issues/{number}/reactions
 *       DELETE /repos/{owner}/{repo}/issues/{number}/reactions/{id}
 */

// GraphQL ReactionContent → REST content string
const REACTION_MAP: Record<string, string> = {
  THUMBS_UP: '+1',
  THUMBS_DOWN: '-1',
  LAUGH: 'laugh',
  HOORAY: 'hooray',
  CONFUSED: 'confused',
  HEART: 'heart',
  ROCKET: 'rocket',
  EYES: 'eyes',
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { content, remove, repo, issueNumber } = await readBody<{
    content: string
    remove: boolean
    repo: string
    issueNumber: number
  }>(event)

  if (!content || !repo || !issueNumber) {
    throw createError({ statusCode: 400, message: 'Missing content, repo or issueNumber' })
  }

  const restContent = REACTION_MAP[content] || content.toLowerCase()
  const [owner, repoName] = repo.split('/')

  if (remove) {
    // Find the reaction ID to delete (first 100 reactions — sufficient for typical issues)
    const { data: reactions } = await githubFetchWithToken<Array<{ id: number, content: string, user: { login: string } }>>(
      token,
      `/repos/${owner}/${repoName}/issues/${issueNumber}/reactions`,
      { params: { per_page: 100 } },
    )
    const mine = reactions.find(r => r.content === restContent && r.user.login === login)
    if (mine) {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${issueNumber}/reactions/${mine.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      if (!res.ok) {
        throw new GitHubError(res.status, 'DELETE reaction', `GitHub API ${res.status}: ${res.statusText}`)
      }
    }
  }
  else {
    await githubFetchWithToken(token, `/repos/${owner}/${repoName}/issues/${issueNumber}/reactions`, {
      method: 'POST',
      body: { content: restContent },
    })
  }

  await invalidateIssueDetailCache(login, repo, issueNumber)
  return { ok: true }
})
