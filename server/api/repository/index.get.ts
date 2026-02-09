export default defineEventHandler(async (event) => {
  const { data } = await githubCachedFetchAll<GitHubRepo>(event, '/user/repos', {
    params: { sort: 'pushed', direction: 'desc', type: 'owner' },
  })

  return data.map(toRepository)
})
