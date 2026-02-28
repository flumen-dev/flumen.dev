import type { CheckRunsResult } from '~~/shared/types/check-run'
import type { ContextNode } from '~~/server/utils/check-run-mapper'
import { mapContextNode } from '~~/server/utils/check-run-mapper'
import { githubGraphQL } from '~~/server/utils/github-graphql'
import { getRepoParams, getSessionToken } from '~~/server/utils/github'
import { mapCiStatus } from '~~/server/utils/focus-created'

const CHECKS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              state
              contexts(first: 100) {
                nodes {
                  __typename
                  ... on CheckRun {
                    databaseId
                    name
                    conclusion
                    status
                    startedAt
                    completedAt
                    detailsUrl
                  }
                  ... on StatusContext {
                    context
                    state
                    targetUrl
                    createdAt
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`

interface GraphQLResult {
  repository: {
    pullRequest: {
      commits: {
        nodes: Array<{
          commit: {
            statusCheckRollup: {
              state: string
              contexts: {
                nodes: ContextNode[]
              }
            } | null
          }
        }>
      }
    } | null
  }
}

const fetchChecks = defineCachedFunction(
  async (_login: string, token: string, owner: string, repo: string, number: number): Promise<CheckRunsResult> => {
    const data = await githubGraphQL<GraphQLResult>(token, CHECKS_QUERY, {
      owner,
      repo,
      number,
    })

    const pr = data.repository?.pullRequest
    if (!pr) {
      throw createError({ statusCode: 404, message: 'Pull request not found' })
    }

    const rollup = pr.commits.nodes[0]?.commit?.statusCheckRollup
    if (!rollup) {
      return {
        rollupStatus: null,
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        checks: [],
        failingNames: [],
      }
    }

    const checks = rollup.contexts.nodes.map(mapContextNode)
    const passed = checks.filter(c => c.status === 'SUCCESS').length
    const failed = checks.filter(c => c.status === 'FAILURE').length
    const pending = checks.filter(c => c.status === 'PENDING').length
    const failingNames = checks.filter(c => c.status === 'FAILURE').map(c => c.name)

    return {
      rollupStatus: mapCiStatus(rollup.state),
      total: checks.length,
      passed,
      failed,
      pending,
      checks,
      failingNames,
    }
  },
  {
    maxAge: 10,
    name: 'pr-checks',
    getKey: (_login: string, _token: string, owner: string, repo: string, number: number) =>
      `${owner}/${repo}:${number}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const number = Number(getRouterParam(event, 'number'))

  if (!Number.isFinite(number) || number <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid pull request number' })
  }

  return fetchChecks(login, token, owner, repo, number)
})
