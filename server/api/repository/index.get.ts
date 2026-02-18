export default defineEventHandler(async (event) => {
  const org = getOrgQuery(event)

  const endpoint = org ? `/orgs/${org}/repos` : '/user/repos'
  const params: Record<string, string> = { sort: 'pushed', direction: 'desc' }
  if (!org) params.type = 'owner'

  const { data } = await githubCachedFetchAll<GitHubRepo>(event, endpoint, { params })

  return data.map(toRepository)
})
