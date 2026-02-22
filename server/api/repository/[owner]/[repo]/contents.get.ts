const fetchContents = defineCachedFunction(
  async (_login: string, token: string, owner: string, repo: string, path: string) => {
    const endpoint = path
      ? `/repos/${owner}/${repo}/contents/${path}`
      : `/repos/${owner}/${repo}/contents`

    const { data } = await githubFetchWithToken<GitHubContent | GitHubContent[]>(
      token,
      endpoint,
    )

    // If it's a directory (array), return tree entries
    if (Array.isArray(data)) {
      return {
        type: 'directory' as const,
        entries: data.map(toRepoTreeEntry),
      }
    }

    // Single file — decode content
    return {
      type: 'file' as const,
      file: toRepoFileContent(data),
    }
  },
  { maxAge: 300, name: 'repo-contents', getKey: (_login: string, _token: string, owner: string, repo: string, path: string) => `${_login}/${owner}/${repo}:${path}` },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const path = (getQuery(event).path as string) || ''
  return fetchContents(login, token, owner, repo, path)
})
