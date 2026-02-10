export function getActivityColor(pushedAt: string | null, archived: boolean): string {
  if (archived) return 'text-error'
  if (!pushedAt) return 'text-dimmed'

  const days = (Date.now() - new Date(pushedAt).getTime()) / (1000 * 60 * 60 * 24)

  if (days < 7) return 'text-success'
  if (days < 30) return 'text-warning'
  return 'text-dimmed'
}
