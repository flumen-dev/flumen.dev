/**
 * Parses an unstorage claim key into repo + issue number.
 * Key format from fs-driver: "issue-claims:owner:repo#number"
 * (unstorage converts `/` to `:` internally)
 */
export function parseClaimKey(key: string): { repo: string, number: number } | null {
  const match = key.match(/issue-claims:([^:]+):([^#]+)#(\d+)$/)
  if (!match) return null
  return { repo: `${match[1]}/${match[2]}`, number: Number(match[3]) }
}
