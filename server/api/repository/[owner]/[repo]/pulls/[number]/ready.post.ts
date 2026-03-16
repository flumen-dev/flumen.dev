import { githubGraphQL } from '~~/server/utils/github-graphql'
import { getRepoParams, getSessionToken } from '~~/server/utils/github'

const PR_ID_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) { id }
  }
}
`

const READY_MUTATION = `
mutation($pullRequestId: ID!) {
  markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
    pullRequest { isDraft }
  }
}
`

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const number = Number(getRouterParam(event, 'number'))

  if (!Number.isFinite(number) || number <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid pull request number' })
  }

  const prData = await githubGraphQL<{ repository: { pullRequest: { id: string } | null } }>(
    token, PR_ID_QUERY, { owner, repo, number },
  )

  const pullRequestId = prData.repository?.pullRequest?.id
  if (!pullRequestId) {
    throw createError({ statusCode: 404, message: 'Pull request not found' })
  }

  const result = await githubGraphQL<{
    markPullRequestReadyForReview: { pullRequest: { isDraft: boolean } }
  }>(token, READY_MUTATION, { pullRequestId })

  return {
    isDraft: result.markPullRequestReadyForReview.pullRequest.isDraft,
  }
})
