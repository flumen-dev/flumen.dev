export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { content, sha } = await readBody<{ content: string, sha: string }>(event)

  const { data } = await githubFetchWithToken<{ content: { sha: string } }>(
    token,
    `/repos/${login}/${login}/contents/README.md`,
    {
      method: 'PUT',
      body: {
        message: 'Update profile README',
        content: Buffer.from(content, 'utf-8').toString('base64'),
        sha,
      },
    },
  )

  return { sha: data.content.sha }
})
