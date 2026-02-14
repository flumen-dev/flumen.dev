export interface ClaimResult {
  forked: boolean
  branchCreated: boolean
  assigned: boolean
  branchName: string
  cloneUrl: string
  command: string
}

export default defineEventHandler(async (event): Promise<ClaimResult> => {
  const { token, login } = await getSessionToken(event)
  const { repo, number, branchName } = await readBody<{
    repo: string
    number: number
    branchName: string
  }>(event)

  if (!repo || !number || !branchName) {
    throw createError({ statusCode: 400, message: 'Missing repo, number, or branchName' })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw createError({ statusCode: 400, message: 'Invalid repo format' })
  }

  // 1. Owner can always push directly, otherwise check collaborator
  let isCollaborator = login.toLowerCase() === owner.toLowerCase()
  if (!isCollaborator) {
    try {
      await githubFetchWithToken(token, `/repos/${owner}/${repoName}/collaborators/${login}`)
      isCollaborator = true
    }
    catch {
      isCollaborator = false
    }
  }

  // 2. Fork if needed
  let forked = false
  let targetOwner = owner
  let cloneUrl = ''

  if (isCollaborator) {
    const repoData = await githubFetchWithToken<{ clone_url: string }>(token, `/repos/${owner}/${repoName}`)
    cloneUrl = repoData.data.clone_url
    targetOwner = owner
  }
  else {
    // Check if fork exists
    let hasFork = false
    try {
      const fork = await githubFetchWithToken<{ fork: boolean, clone_url: string }>(token, `/repos/${login}/${repoName}`)
      if (fork.data.fork) {
        hasFork = true
        cloneUrl = fork.data.clone_url
      }
    }
    catch {
      hasFork = false
    }

    if (!hasFork) {
      // Create fork
      const forkResult = await githubFetchWithToken<{ clone_url: string }>(
        token,
        `/repos/${owner}/${repoName}/forks`,
        { method: 'POST' },
      )
      cloneUrl = forkResult.data.clone_url
      forked = true

      // Poll until fork is ready (max 30s)
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          await githubFetchWithToken(token, `/repos/${login}/${repoName}`)
          break
        }
        catch {
          if (i === 14) {
            throw createError({ statusCode: 504, message: 'Fork creation timed out' })
          }
        }
      }
    }

    targetOwner = login
  }

  // 3. Get default branch SHA (try main, then master)
  let sha: string
  try {
    const refData = await githubFetchWithToken<{ object: { sha: string } }>(
      token,
      `/repos/${owner}/${repoName}/git/ref/heads/main`,
    )
    sha = refData.data.object.sha
  }
  catch {
    try {
      const refData = await githubFetchWithToken<{ object: { sha: string } }>(
        token,
        `/repos/${owner}/${repoName}/git/ref/heads/master`,
      )
      sha = refData.data.object.sha
    }
    catch {
      throw createError({ statusCode: 404, message: `No default branch found for ${owner}/${repoName}` })
    }
  }

  // 4. Create branch
  let branchCreated = false
  try {
    await githubFetchWithToken(
      token,
      `/repos/${targetOwner}/${repoName}/git/refs`,
      {
        method: 'POST',
        body: { ref: `refs/heads/${branchName}`, sha },
      },
    )
    branchCreated = true
  }
  catch (err: unknown) {
    const error = err as { statusCode?: number }
    if (error.statusCode === 422) {
      throw createError({ statusCode: 409, message: 'Branch already exists' })
    }
    throw err
  }

  // 5. Assign user to issue
  let assigned = false
  try {
    await githubFetchWithToken(
      token,
      `/repos/${owner}/${repoName}/issues/${number}/assignees`,
      {
        method: 'POST',
        body: { assignees: [login] },
      },
    )
    assigned = true
  }
  catch {
    // Non-collaborators can't self-assign — that's ok
    assigned = false
  }

  // 6. Store claim in KV (append to claims array)
  const storage = useStorage('data')
  const claimsKey = `issue-claims:${owner}/${repoName}#${number}`
  const existingClaims = await storage.getItem<Array<{ login: string, branchName: string, claimedAt: string }>>(claimsKey) ?? []
  const updatedClaims = existingClaims.filter(c => c.login !== login)
  updatedClaims.push({ login, branchName, claimedAt: new Date().toISOString() })
  await storage.setItem(claimsKey, updatedClaims)

  // 7. Build command
  const command = isCollaborator
    ? `git fetch origin && git checkout ${branchName}`
    : `git clone ${cloneUrl} && cd ${repoName} && git checkout ${branchName}`

  return {
    forked,
    branchCreated,
    assigned,
    branchName,
    cloneUrl,
    command,
  }
})
