const GITHUB_GRAPHQL = 'https://api.github.com/graphql'

interface GraphQLResponse<T> {
  data: T
  errors?: Array<{ message: string }>
}

export async function githubGraphQL<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new GitHubError(response.status, '/graphql', `GitHub GraphQL ${response.status}: ${response.statusText}`)
  }

  const result = await response.json() as GraphQLResponse<T>

  if (result.errors?.length) {
    throw new GitHubError(422, '/graphql', result.errors.map(e => e.message).join(', '))
  }

  return result.data
}

/**
 * Fetches open PR and issue counts for a list of repositories via GraphQL.
 * Batches up to 100 repos per request using aliases.
 */
export async function githubRepoCountsGraphQL(
  token: string,
  repos: Array<{ owner: string, name: string }>,
): Promise<{ prCounts: Record<string, number>, issueCounts: Record<string, number> }> {
  const prCounts: Record<string, number> = {}
  const issueCounts: Record<string, number> = {}

  // GraphQL has a complexity limit — batch in chunks of 100
  const chunks = chunkArray(repos, 100)

  for (const chunk of chunks) {
    const fragments = chunk.map((repo, i) =>
      `r${i}: repository(owner: "${repo.owner}", name: "${repo.name}") {
        pullRequests(states: OPEN) { totalCount }
        issues(states: OPEN) { totalCount }
      }`,
    ).join('\n')

    const query = `query { ${fragments} }`

    const data = await githubGraphQL<Record<string, {
      pullRequests: { totalCount: number }
      issues: { totalCount: number }
    }>>(token, query)

    for (let i = 0; i < chunk.length; i++) {
      const repo = chunk[i]!
      const result = data[`r${i}`]
      if (result) {
        const fullName = `${repo.owner}/${repo.name}`
        if (result.pullRequests.totalCount > 0) {
          prCounts[fullName] = result.pullRequests.totalCount
        }
        if (result.issues.totalCount > 0) {
          issueCounts[fullName] = result.issues.totalCount
        }
      }
    }
  }

  return { prCounts, issueCounts }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
