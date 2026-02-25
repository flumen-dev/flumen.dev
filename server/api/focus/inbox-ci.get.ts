import { mapCiStatus } from '~~/server/utils/focus-created'

/**
 * Lightweight CI status polling endpoint.
 * Accepts a comma-separated list of "owner/repo#number" PR identifiers
 * and returns their current CI status in a single GraphQL request.
 */
export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)

  const query = getQuery(event)
  const prs = ((query.prs as string) || '').split(',').filter(Boolean)

  if (prs.length === 0) return {}
  if (prs.length > 50) {
    throw createError({ statusCode: 400, statusMessage: 'Too many PRs (max 50)' })
  }

  // Parse "owner/repo#number" into structured data
  const parsed = prs.map((key, i) => {
    const match = key.match(/^(.+?)\/(.+?)#(\d+)$/)
    if (!match) return null
    return { alias: `pr${i}`, owner: match[1]!, name: match[2]!, number: Number(match[3]) }
  }).filter(Boolean) as Array<{ alias: string, owner: string, name: string, number: number }>

  if (parsed.length === 0) return {}

  // Build a single GraphQL query with aliases — one field per PR
  const fragments = parsed.map(p =>
    `${p.alias}: repository(owner: "${p.owner}", name: "${p.name}") {
      pullRequest(number: ${p.number}) {
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup { state }
            }
          }
        }
      }
    }`,
  ).join('\n')

  const gqlQuery = `query CIPoll { ${fragments} }`

  type PRResult = {
    pullRequest: {
      commits: {
        nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }>
      }
    } | null
  }

  const data = await githubGraphQL<Record<string, PRResult>>(token, gqlQuery)

  // Map results back to original keys
  const result: Record<string, 'SUCCESS' | 'FAILURE' | 'PENDING' | null> = {}
  for (const p of parsed) {
    const pr = data[p.alias]?.pullRequest
    const raw = pr?.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
    result[`${p.owner}/${p.name}#${p.number}`] = mapCiStatus(raw)
  }

  return result
})
