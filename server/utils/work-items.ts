export function workItemIdFromIssue(number: number): string {
  return String(number)
}

export function workItemIdFromPull(number: number): string {
  return `pr-${number}`
}

export function parseWorkItemId(id: string): { type: 'issue' | 'pull', number: number } {
  if (id.startsWith('pr-')) {
    const number = Number(id.slice(3))
    if (!Number.isInteger(number) || number <= 0) {
      throw createError({ statusCode: 400, message: 'Invalid work item id' })
    }
    return { type: 'pull', number }
  }

  const number = Number(id)
  if (!Number.isInteger(number) || number <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid work item id' })
  }
  return { type: 'issue', number }
}
