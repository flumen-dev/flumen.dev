import type { GraphQLPullDetailResult, PullDetail } from '~~/shared/types/pull-detail'
import { githubGraphQL } from '~~/server/utils/github-graphql'
import { getRepoParams, getSessionToken } from '~~/server/utils/github'

const PULL_DETAIL_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      id
      number
      title
      state
      isDraft
      url
      body
      bodyHTML
      createdAt
      updatedAt
      mergedAt
      author { login avatarUrl }
      labels(first: 20) { nodes { name color } }
      assignees(first: 10) { nodes { login avatarUrl } }
      reviewRequests(first: 20) {
        nodes {
          requestedReviewer {
            ... on User { login avatarUrl }
          }
        }
      }
      closingIssuesReferences(first: 20) {
        nodes {
          number
          title
          state
          url
        }
      }
    }
  }
}
`

const fetchPullDetail = defineCachedFunction(
  async (login: string, token: string, owner: string, repo: string, number: number): Promise<PullDetail> => {
    const data = await githubGraphQL<GraphQLPullDetailResult>(token, PULL_DETAIL_QUERY, {
      owner,
      repo,
      number,
    })

    const pull = data.repository.pullRequest
    if (!pull) {
      throw createError({ statusCode: 404, message: 'Pull request not found' })
    }

    return {
      id: pull.id,
      number: pull.number,
      title: pull.title,
      state: pull.state,
      isDraft: pull.isDraft,
      url: pull.url,
      body: pull.body,
      bodyHTML: pull.bodyHTML,
      createdAt: pull.createdAt,
      updatedAt: pull.updatedAt,
      mergedAt: pull.mergedAt,
      author: pull.author ?? { login: 'ghost', avatarUrl: '' },
      labels: pull.labels.nodes,
      assignees: pull.assignees.nodes,
      requestedReviewers: pull.reviewRequests.nodes
        .map(node => node.requestedReviewer)
        .filter((reviewer): reviewer is { login: string, avatarUrl: string } => reviewer !== null),
      linkedIssues: pull.closingIssuesReferences.nodes,
    }
  },
  {
    maxAge: 60,
    name: 'repo-pull-detail',
    getKey: (login: string, _token: string, owner: string, repo: string, number: number) => `${login}:${owner}/${repo}#${number}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const number = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(number) || number <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid pull request number' })
  }

  return fetchPullDetail(login, token, owner, repo, number)
})
