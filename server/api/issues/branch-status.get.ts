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

const BRANCH_STATUS_QUERY = /* GraphQL */ `
  query BranchStatus($owner: String!, $repo: String!, $branchRef: String!, $forkOwner: String!) {
    repository(owner: $owner, name: $repo) {
      viewerPermission
      defaultBranchRef { name }
      url
      ref(qualifiedName: $branchRef) { name }
    }
    fork: repository(owner: $forkOwner, name: $repo) {
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

  const data = await githubGraphQL<BranchStatusQueryResult>(token, BRANCH_STATUS_QUERY, {
    owner,
    repo: repoName,
    branchRef,
    forkOwner: login,
  })

  if (!data.repository) {
    throw createError({ statusCode: 404, message: 'Repository not found' })
  }

  const { viewerPermission, defaultBranchRef } = data.repository
  const isCollaborator = !!viewerPermission && ['ADMIN', 'MAINTAIN', 'WRITE'].includes(viewerPermission)
  const defaultBranch = defaultBranchRef?.name ?? 'main'

  // 3. Determine branch existence + clone URL based on collaborator status
  const hasFork = !!data.fork?.isFork
  const forkFullName = hasFork ? data.fork!.nameWithOwner : null

  let branchExists: boolean
  let cloneUrl: string | null

  if (isCollaborator) {
    branchExists = !!data.repository.ref
    cloneUrl = data.repository.url + '.git'
  }
  else {
    branchExists = !!data.fork?.ref
    cloneUrl = hasFork ? data.fork!.url + '.git' : null
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
