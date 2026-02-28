type WorkItemPathType = 'issue' | 'pr' | 'pull'

function toWorkItemId(number: number | string, type: WorkItemPathType) {
  if (type === 'issue') {
    return String(number)
  }

  return `pr-${number}`
}

export function buildWorkItemPath(repoFullName: string, number: number | string, type: WorkItemPathType = 'issue') {
  const parts = repoFullName.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null
  }

  const [owner, repo] = parts

  return `/repos/${owner}/${repo}/work-items/${toWorkItemId(number, type)}`
}
