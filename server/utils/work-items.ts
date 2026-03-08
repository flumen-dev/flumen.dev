export function parseWorkItemId(id: string): { number: number } {
  // Legacy pr- prefix support
  const raw = id.startsWith('pr-') ? id.slice(3) : id
  const number = Number(raw)
  if (!Number.isInteger(number) || number <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid work item id' })
  }
  return { number }
}
