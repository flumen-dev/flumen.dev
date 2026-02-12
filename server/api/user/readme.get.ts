interface GitHubContent {
  content: string
  sha: string
}

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)

  try {
    const { data } = await githubFetchWithToken<GitHubContent>(
      token,
      `/repos/${login}/${login}/contents/README.md`,
    )
    return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha }
  }
  catch (err) {
    if (err instanceof GitHubError && err.status === 404) {
      return { content: null, sha: null }
    }
    throw err
  }
})
