export interface IssueClaim {
  login: string
  branchName: string
  claimedAt: string
}

export interface BranchStatus {
  isCollaborator: boolean
  hasFork: boolean
  forkFullName: string | null
  branchExists: boolean
  defaultBranch: string
  suggestedBranch: string
  cloneUrl: string | null
  claims: IssueClaim[]
}

interface BranchStatusQueryResult {
  repository: {
    viewerPermission: 'ADMIN' | 'MAINTAIN' | 'WRITE' | 'TRIAGE' | 'READ' | null
    defaultBranchRef: { name: string } | null
    url: string
    ref: { name: string } | null
  } | null
  fork: {
    isFork: boolean
    nameWithOwner: string
    url: string
    ref: { name: string } | null
  } | null
}

const REPO_QUERY = /* GraphQL */ `
  query BranchStatus($owner: String!, $repo: String!, $branchRef: String!) {
    repository(owner: $owner, name: $repo) {
      viewerPermission
      defaultBranchRef { name }
      url
      ref(qualifiedName: $branchRef) { name }
    }
  }
`

const FORK_QUERY = /* GraphQL */ `
  query ForkStatus($forkOwner: String!, $repo: String!, $branchRef: String!) {
    repository(owner: $forkOwner, name: $repo) {
      isFork
      nameWithOwner
      url
      ref(qualifiedName: $branchRef) { name }
    }
  }
`

export default defineEventHandler(async (event): Promise<BranchStatus> => {
  const { token, login } = await getSessionToken(event)
  const { repo, number, branch } = getQuery<{ repo?: string, number?: string, branch?: string }>(event)

  if (!repo || !number) {
    throw createError({ statusCode: 400, message: 'Missing repo or number' })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw createError({ statusCode: 400, message: 'Invalid repo format' })
  }

  // 1. Check KV for stored claims
  const storage = useStorage('data')
  const claimsKey = `issue-claims:${owner}/${repoName}#${number}`
  const claims = await storage.getItem<IssueClaim[]>(claimsKey) ?? []

  // Find current user's claim (if any)
  const myClaim = claims.find(c => c.login === login)
  const suggestedBranch = branch || myClaim?.branchName || `issue-${Number(number)}`

  // 2. Single GraphQL query: repo permissions, default branch, fork status, branch existence
  const branchRef = `refs/heads/${suggestedBranch}`

  const repoData = await githubGraphQL<{ repository: BranchStatusQueryResult['repository'] }>(token, REPO_QUERY, {
    owner,
    repo: repoName,
    branchRef,
  })

  if (!repoData.repository) {
    throw createError({ statusCode: 404, message: 'Repository not found' })
  }

  // Fork query may fail if user has no fork — that's ok
  let forkData: BranchStatusQueryResult['fork'] = null
  try {
    const result = await githubGraphQL<{ repository: BranchStatusQueryResult['fork'] }>(token, FORK_QUERY, {
      forkOwner: login,
      repo: repoName,
      branchRef,
    })
    if (result.repository?.isFork) {
      forkData = result.repository
    }
  }
  catch (e) {
    const isForkNotFound = e instanceof GitHubError && e.message.includes('Could not resolve to a Repository')
    if (!isForkNotFound) throw e
  }

  const repoInfo = repoData.repository
  const { viewerPermission, defaultBranchRef } = repoInfo
  const isCollaborator = !!viewerPermission && ['ADMIN', 'MAINTAIN', 'WRITE'].includes(viewerPermission)
  const defaultBranch = defaultBranchRef?.name ?? 'main'

  // 3. Determine branch existence + clone URL based on collaborator status
  const hasFork = !!forkData?.isFork
  const forkFullName = hasFork ? forkData!.nameWithOwner : null

  let branchExists: boolean
  let cloneUrl: string | null

  if (isCollaborator) {
    branchExists = !!repoInfo.ref
    cloneUrl = repoInfo.url + '.git'
  }
  else {
    branchExists = !!forkData?.ref
    cloneUrl = hasFork ? forkData!.url + '.git' : null
  }

  // 4. Clean up current user's claim if their branch was deleted
  if (myClaim && !branchExists) {
    const updatedClaims = claims.filter(c => c.login !== login)
    if (updatedClaims.length > 0) {
      await storage.setItem(claimsKey, updatedClaims)
    }
    else {
      await storage.removeItem(claimsKey)
    }
    return {
      isCollaborator,
      hasFork,
      forkFullName,
      branchExists: false,
      defaultBranch,
      suggestedBranch,
      cloneUrl,
      claims: updatedClaims,
    }
  }

  return {
    isCollaborator,
    hasFork,
    forkFullName,
    branchExists,
    defaultBranch,
    suggestedBranch,
    cloneUrl,
    claims,
  }
})
