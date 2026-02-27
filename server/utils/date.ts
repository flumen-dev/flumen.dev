export function daysBetween(from: string, to: Date): number {
  const ms = to.getTime() - new Date(from).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}
