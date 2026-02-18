const ORGS_QUERY = `
query {
  viewer {
    organizations(first: 100) {
      nodes {
        login
        name
        avatarUrl
      }
    }
  }
}
`

export interface UserOrg {
  login: string
  name: string | null
  avatarUrl: string
}

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)

  const data = await githubGraphQL<{
    viewer: {
      organizations: {
        nodes: UserOrg[]
      }
    }
  }>(token, ORGS_QUERY)

  return data.viewer.organizations.nodes
})
