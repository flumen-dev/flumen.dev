import type { RecentItemType, RecentSyncResult } from '~~/shared/types/recent'

interface SyncInput {
  type: RecentItemType
  repo: string
  number: number
}

/**
 * Batch-fetch latest title + updatedAt for tracked items via GraphQL.
 * Chunks into groups of 100 to respect GitHub's complexity limits.
 */
export default defineEventHandler(async (event): Promise<RecentSyncResult[]> => {
  const { token } = await getSessionToken(event)
  const body = await readBody<{ items: SyncInput[] }>(event)

  if (!body?.items?.length) return []

  const results: RecentSyncResult[] = []
  const chunks = chunkArray(body.items, 100)

  for (const chunk of chunks) {
    const fragments = chunk.map((item, i) => {
      const [owner, name] = item.repo.split('/')
      const safeOwner = sanitizeGraphQL(owner ?? '')
      const safeName = sanitizeGraphQL(name ?? '')
      const typeName = item.type === 'pr' ? 'PullRequest' : 'Issue'
      return `r${i}: repository(owner: "${safeOwner}", name: "${safeName}") {
        item: issueOrPullRequest(number: ${Number(item.number)}) {
          ... on ${typeName} {
            title
            updatedAt
          }
        }
      }`
    }).join('\n')

    const query = `query { ${fragments} }`

    const data = await githubGraphQL<Record<string, {
      item: { title: string, updatedAt: string } | null
    }>>(token, query)

    for (let i = 0; i < chunk.length; i++) {
      const input = chunk[i]!
      const result = data[`r${i}`]?.item
      if (result) {
        results.push({
          key: `${input.type}:${input.repo}#${input.number}`,
          title: result.title,
          updatedAt: result.updatedAt,
        })
      }
    }
  }

  return results
})
