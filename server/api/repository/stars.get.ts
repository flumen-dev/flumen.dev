export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const raw = getQuery<{ repos?: string }>(event).repos

  if (!raw) {
    throw createError({ statusCode: 400, message: 'Missing repos query parameter' })
  }

  const repos = raw.split(',').filter(Boolean).slice(0, 100)
  if (!repos.length) return {}

  const parsed = repos.map((fullName) => {
    const [owner, name] = fullName.split('/')
    return { owner: owner!, name: name!, fullName }
  }).filter(r => r.owner && r.name)

  const fragments = parsed.map((repo, i) =>
    `r${i}: repository(owner: "${repo.owner}", name: "${repo.name}") {
      viewerHasStarred
      stargazerCount
    }`,
  ).join('\n')

  const data = await githubGraphQL<Record<string, {
    viewerHasStarred: boolean
    stargazerCount: number
  } | null>>(token, `query { ${fragments} }`)

  const result: Record<string, { starred: boolean, count: number }> = {}
  for (let i = 0; i < parsed.length; i++) {
    const entry = data[`r${i}`]
    if (entry) {
      result[parsed[i]!.fullName] = {
        starred: entry.viewerHasStarred,
        count: entry.stargazerCount,
      }
    }
  }

  return result
})
