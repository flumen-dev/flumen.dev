const STAR_MUTATION = /* GraphQL */ `
  mutation StarRepo($id: ID!) {
    addStar(input: { starrableId: $id }) {
      starrable {
        ... on Repository {
          viewerHasStarred
          stargazerCount
        }
      }
    }
  }
`

const UNSTAR_MUTATION = /* GraphQL */ `
  mutation UnstarRepo($id: ID!) {
    removeStar(input: { starrableId: $id }) {
      starrable {
        ... on Repository {
          viewerHasStarred
          stargazerCount
        }
      }
    }
  }
`

const REPO_ID_QUERY = /* GraphQL */ `
  query RepoId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { repo, starred } = await readBody<{ repo: string, starred: boolean }>(event)

  if (!repo || typeof starred !== 'boolean') {
    throw createError({ statusCode: 400, message: 'Missing repo or starred field' })
  }

  const [owner, name] = repo.split('/')
  if (!owner || !name) {
    throw createError({ statusCode: 400, message: 'Invalid repo format, expected owner/name' })
  }

  const { repository } = await githubGraphQL<{
    repository: { id: string } | null
  }>(token, REPO_ID_QUERY, { owner, name })

  if (!repository) {
    throw createError({ statusCode: 404, message: 'Repository not found' })
  }

  const mutation = starred ? STAR_MUTATION : UNSTAR_MUTATION
  const data = await githubGraphQL<{
    addStar?: { starrable: { viewerHasStarred: boolean, stargazerCount: number } }
    removeStar?: { starrable: { viewerHasStarred: boolean, stargazerCount: number } }
  }>(token, mutation, { id: repository.id })

  const result = data.addStar?.starrable ?? data.removeStar?.starrable
  if (!result) {
    throw createError({ statusCode: 502, message: 'GitHub mutation returned no starrable data' })
  }
  return {
    viewerHasStarred: result.viewerHasStarred,
    stargazerCount: result.stargazerCount,
  }
})
