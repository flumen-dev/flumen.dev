type WorkItemPathType = 'issue' | 'pr' | 'pull'

function toWorkItemId(number: number | string, type: WorkItemPathType) {
  if (type === 'issue') {
    return String(number)
  }

  return `pr-${number}`
}

export function buildWorkItemPath(repoFullName: string, number: number | string, type: WorkItemPathType = 'issue') {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) {
    return null
  }

  return `/repos/${owner}/${repo}/work-items/${toWorkItemId(number, type)}`
}
