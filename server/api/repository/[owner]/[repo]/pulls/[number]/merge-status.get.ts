import type { MergeableState, MergeStateStatus, MergeStrategy, MergeStatusResult } from '~~/shared/types/merge'
import { githubGraphQL } from '~~/server/utils/github-graphql'
import { getRepoParams, getSessionToken } from '~~/server/utils/github'

const MERGE_STATUS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    mergeCommitAllowed
    squashMergeAllowed
    rebaseMergeAllowed
    viewerPermission
    pullRequest(number: $number) {
      mergeable
      mergeStateStatus
      headRefName
      baseRefName
      commits(last: 1) { totalCount nodes { commit { oid } } }
      title
      body
    }
  }
}
`

interface GraphQLResult {
  repository: {
    mergeCommitAllowed: boolean
    squashMergeAllowed: boolean
    rebaseMergeAllowed: boolean
    viewerPermission: string | null
    pullRequest: {
      mergeable: MergeableState
      mergeStateStatus: MergeStateStatus
      headRefName: string
      baseRefName: string
      commits: { totalCount: number, nodes: { commit: { oid: string } }[] }
      title: string
      body: string
    } | null
  }
}

const WRITE_PERMISSIONS = new Set(['ADMIN', 'MAINTAIN', 'WRITE'])

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const number = Number(getRouterParam(event, 'number'))

  if (!Number.isFinite(number) || number <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid pull request number' })
  }

  const data = await githubGraphQL<GraphQLResult>(token, MERGE_STATUS_QUERY, {
    owner,
    repo,
    number,
  })

  const repoData = data.repository
  const pr = repoData?.pullRequest
  if (!pr) {
    throw createError({ statusCode: 404, message: 'Pull request not found' })
  }

  const allowedStrategies: MergeStrategy[] = []
  if (repoData.mergeCommitAllowed) allowedStrategies.push('merge')
  if (repoData.squashMergeAllowed) allowedStrategies.push('squash')
  if (repoData.rebaseMergeAllowed) allowedStrategies.push('rebase')

  const defaultStrategy = allowedStrategies.includes('squash')
    ? 'squash'
    : allowedStrategies[0] ?? 'merge'

  const defaultTitle = `${pr.title} (#${number})`

  const hasWriteAccess = WRITE_PERMISSIONS.has(repoData.viewerPermission ?? '')
  const isClean = pr.mergeable === 'MERGEABLE' && (pr.mergeStateStatus === 'CLEAN' || pr.mergeStateStatus === 'HAS_HOOKS' || pr.mergeStateStatus === 'UNSTABLE')
  const canMerge = hasWriteAccess && isClean && allowedStrategies.length > 0

  return {
    canMerge,
    mergeable: pr.mergeable,
    mergeState: pr.mergeStateStatus,
    allowedStrategies,
    defaultStrategy,
    headBranch: pr.headRefName,
    baseBranch: pr.baseRefName,
    commitCount: pr.commits.totalCount,
    defaultTitle,
    defaultBody: pr.body ?? '',
    headSha: pr.commits.nodes[0]?.commit.oid ?? '',
  } satisfies MergeStatusResult
})
