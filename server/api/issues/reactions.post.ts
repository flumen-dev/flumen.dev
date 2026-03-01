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
  const { content, remove, repo, issueNumber, pullCommentId, workItemId } = await readBody<{
    content: string
    remove: boolean
    repo: string
    issueNumber: number
    pullCommentId?: number
    workItemId?: string
  }>(event)

  if (!content || !repo || !issueNumber) {
    throw createError({ statusCode: 400, message: 'Missing content, repo or issueNumber' })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName || repo.split('/').length !== 2) {
    throw createError({ statusCode: 400, message: 'Invalid repo format, expected owner/repo' })
  }
  if (pullCommentId !== undefined && (!Number.isInteger(pullCommentId) || pullCommentId <= 0)) {
    throw createError({ statusCode: 400, message: 'Invalid pullCommentId' })
  }

  const restContent = REACTION_MAP[content] || content.toLowerCase()

  // Review comment reactions use a different endpoint
  const reactionsPath = pullCommentId
    ? `/repos/${owner}/${repoName}/pulls/comments/${pullCommentId}/reactions`
    : `/repos/${owner}/${repoName}/issues/${issueNumber}/reactions`

  if (remove) {
    // Find the reaction ID to delete (first 100 reactions — sufficient for typical issues)
    const { data: reactions } = await githubFetchWithToken<Array<{ id: number, content: string, user: { login: string } }>>(
      token,
      reactionsPath,
      { params: { per_page: 100 } },
    )
    const mine = reactions.find(r => r.content === restContent && r.user.login === login)
    if (mine) {
      const res = await fetch(`https://api.github.com${reactionsPath}/${mine.id}`, {
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
    await githubFetchWithToken(token, reactionsPath, {
      method: 'POST',
      body: { content: restContent },
    })
  }

  await invalidateIssueDetailCache(login, repo, issueNumber)
  if (workItemId) {
    const [ownerPart, repoPart] = repo.split('/')
    if (ownerPart && repoPart) {
      await invalidateWorkItemDetailCache(login, ownerPart, repoPart, workItemId)
    }
  }
  return { ok: true }
})
