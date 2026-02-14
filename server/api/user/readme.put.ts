export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { content, sha } = await readBody<{ content: string, sha?: string }>(event)

  // Ensure profile repo exists (same name as username)
  if (!sha) {
    try {
      await githubFetchWithToken(token, `/repos/${login}/${login}`)
    }
    catch (err) {
      if (!(err instanceof GitHubError) || err.status !== 404) throw err
      // Repo doesn't exist — create it
      await githubFetchWithToken(token, '/user/repos', {
        method: 'POST',
        body: {
          name: login,
          description: `${login}'s profile repository`,
          auto_init: false,
          private: false,
        },
      })
    }
  }

  const body: Record<string, string> = {
    message: sha ? 'Update profile README' : 'Create profile README',
    content: Buffer.from(content, 'utf-8').toString('base64'),
  }
  if (sha) body.sha = sha

  const { data } = await githubFetchWithToken<{ content: { sha: string } }>(
    token,
    `/repos/${login}/${login}/contents/README.md`,
    { method: 'PUT', body },
  )

  return { sha: data.content.sha }
})
