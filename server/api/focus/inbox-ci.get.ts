import { mapCiStatus } from '~~/server/utils/focus-created'

const PR_KEY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#(\d+)$/

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

  // Parse and validate "owner/repo#number"
  const parsed: Array<{ alias: string, owner: string, name: string, number: number }> = []
  for (let i = 0; i < prs.length; i++) {
    const key = prs[i]!
    if (!PR_KEY_RE.test(key)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid PR key: ${key}` })
    }
    const [ownerName, numStr] = key.split('#')
    const [owner, name] = ownerName!.split('/')
    parsed.push({ alias: `pr${i}`, owner: owner!, name: name!, number: Number(numStr) })
  }

  if (parsed.length === 0) return {}

  // Build GraphQL query using variables for owner/name/number
  const varDefs = parsed.map(p =>
    `$${p.alias}Owner: String!, $${p.alias}Name: String!, $${p.alias}Number: Int!`,
  ).join(', ')

  const fragments = parsed.map(p =>
    `${p.alias}: repository(owner: $${p.alias}Owner, name: $${p.alias}Name) {
      pullRequest(number: $${p.alias}Number) {
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

  const gqlQuery = `query CIPoll(${varDefs}) { ${fragments} }`

  const variables: Record<string, string | number> = {}
  for (const p of parsed) {
    variables[`${p.alias}Owner`] = p.owner
    variables[`${p.alias}Name`] = p.name
    variables[`${p.alias}Number`] = p.number
  }

  type PRResult = {
    pullRequest: {
      commits: {
        nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }>
      }
    } | null
  }

  const data = await githubGraphQL<Record<string, PRResult>>(token, gqlQuery, variables)

  // Map results back to original keys
  const result: Record<string, 'SUCCESS' | 'FAILURE' | 'PENDING' | null> = {}
  for (const p of parsed) {
    const pr = data[p.alias]?.pullRequest
    const raw = pr?.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
    result[`${p.owner}/${p.name}#${p.number}`] = mapCiStatus(raw)
  }

  return result
})
