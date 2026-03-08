const GITHUB_REFERENCE_KEYWORD_GROUP = '(close[sd]?|fix(?:e[sd])?|resolve[sd]?)'
const GITHUB_REFERENCE_NUMBER_GROUP = '(\\d+)'

export const GITHUB_REFERENCE_MATCHER = `${GITHUB_REFERENCE_KEYWORD_GROUP}\\s+#${GITHUB_REFERENCE_NUMBER_GROUP}`

export function createGitHubReferenceRegex(flags = 'gi') {
  return new RegExp(`\\b${GITHUB_REFERENCE_MATCHER}\\b`, flags)
}

export const GITHUB_REFERENCE_INPUT_REGEX = new RegExp(`${GITHUB_REFERENCE_MATCHER}\\s$`, 'i')

const GITHUB_REFERENCE_ATTRS_REGEX = new RegExp(`^${GITHUB_REFERENCE_MATCHER}$`, 'i')

const ISSUE_REFERENCE_KEYWORD = '(close[sd]?|fix(?:e[sd])?|resolve[sd]?)'
const CROSS_REPO = '([a-zA-Z\\d](?:[a-zA-Z\\d._-]*[a-zA-Z\\d])?\\/[a-zA-Z\\d](?:[a-zA-Z\\d._-]*[a-zA-Z\\d])?)'
const ISSUE_NUMBER = '([1-9]\\d*)'

/**
 * Regex matching all issue/PR reference formats:
 * - keyword refs: `closes #123`, `fixes #5`, `resolves #45`
 * - cross-repo: `owner/repo#123`
 * - bare refs: `#123`
 *
 * Groups: [1]=keyword, [2]=number (keyword ref) | [3]=owner/repo, [4]=number (cross-repo) | [5]=number (bare ref)
 */
export function createIssueReferenceRegex(flags = 'gi') {
  return new RegExp(
    `\\b${ISSUE_REFERENCE_KEYWORD}\\s+#${ISSUE_NUMBER}\\b`
    + `|\\b${CROSS_REPO}#${ISSUE_NUMBER}\\b`
    + `|(?<!\\w)#${ISSUE_NUMBER}\\b`,
    flags,
  )
}

export function parseGitHubReference(value: string) {
  const match = value.trim().match(GITHUB_REFERENCE_ATTRS_REGEX)
  if (!match) return null

  return {
    keyword: match[1]!.toLowerCase(),
    number: Number.parseInt(match[2]!, 10),
  }
}
