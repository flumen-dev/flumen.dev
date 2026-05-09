import type { LinkedIssue } from '~~/shared/types/linked-issue'

const QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      closingIssuesReferences(first: 20) {
        nodes {
          id
          number
          title
          state
          stateReason
          url
          author { login avatarUrl }
          repository { nameWithOwner }
        }
      }
    }
  }
}
`

interface QueryResult {
  repository: {
    pullRequest: {
      closingIssuesReferences: {
        nodes: Array<{
          id: string
          number: number
          title: string
          state: 'OPEN' | 'CLOSED'
          stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
          url: string
          author: { login: string, avatarUrl: string } | null
          repository: { nameWithOwner: string }
        }>
      }
    } | null
  } | null
}

export default defineEventHandler(async (event): Promise<LinkedIssue[]> => {
  const { token } = await getSessionToken(event)
  const { owner, repo, number } = getRouterParams(event)

  if (!owner || !repo || !number) {
    throw createError({ statusCode: 400, message: 'Missing route params' })
  }

  const num = Number(number)
  if (!Number.isInteger(num) || num <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid PR number' })
  }

  const data = await githubGraphQL<QueryResult>(token, QUERY, {
    owner,
    name: repo,
    number: num,
  })

  const nodes = data.repository?.pullRequest?.closingIssuesReferences.nodes ?? []
  return nodes.map(n => ({
    id: n.id,
    number: n.number,
    title: n.title,
    state: n.state,
    stateReason: n.stateReason,
    url: n.url,
    author: n.author ?? { login: 'ghost', avatarUrl: '' },
    repository: n.repository,
  }))
})
