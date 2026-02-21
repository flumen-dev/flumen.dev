/**
 * Slugifies text for use in branch names.
 * Lowercases, replaces non-alphanumeric runs with hyphens, trims hyphens, max 40 chars.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

/**
 * Generates a suggested branch name from an issue number and title.
 */
export function suggestBranchName(issueNumber: number, title: string): string {
  return `issue-${issueNumber}-${slugify(title)}`
}
