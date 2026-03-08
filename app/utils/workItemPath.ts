export function buildWorkItemPath(repoFullName: string, number: number | string) {
  const parts = repoFullName.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null
  }

  const [owner, repo] = parts

  return `/repos/${owner}/${repo}/work-items/${number}`
}
