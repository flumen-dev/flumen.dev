const GITHUB_REFERENCE_KEYWORD_GROUP = '(close|closes|fix|fixes|resolve|resolves)'
const GITHUB_REFERENCE_NUMBER_GROUP = '(\\d+)'

export const GITHUB_REFERENCE_MATCHER = `${GITHUB_REFERENCE_KEYWORD_GROUP}\\s+#${GITHUB_REFERENCE_NUMBER_GROUP}`

export function createGitHubReferenceRegex(flags = 'gi') {
  return new RegExp(`\\b${GITHUB_REFERENCE_MATCHER}\\b`, flags)
}

export const GITHUB_REFERENCE_INPUT_REGEX = new RegExp(`${GITHUB_REFERENCE_MATCHER}\\s$`, 'i')

const GITHUB_REFERENCE_ATTRS_REGEX = new RegExp(`^${GITHUB_REFERENCE_MATCHER}$`, 'i')

export function parseGitHubReference(value: string) {
  const match = value.trim().match(GITHUB_REFERENCE_ATTRS_REGEX)
  if (!match) return null

  return {
    keyword: match[1]!.toLowerCase(),
    number: Number.parseInt(match[2]!, 10),
  }
}
