type WorkItemPathType = 'issue' | 'pr' | 'pull'

function toWorkItemId(number: number | string, type: WorkItemPathType) {
  const stringifiedNumber = String(number)

  if (type === 'issue') {
    return stringifiedNumber
  }

  if (stringifiedNumber.startsWith('pr-')) {
    return stringifiedNumber
  }

  return `pr-${stringifiedNumber}`
}

export function buildWorkItemPath(repoFullName: string, number: number | string, type: WorkItemPathType = 'issue') {
  const parts = repoFullName.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null
  }

  const [owner, repo] = parts

  return `/repos/${owner}/${repo}/work-items/${toWorkItemId(number, type)}`
}
