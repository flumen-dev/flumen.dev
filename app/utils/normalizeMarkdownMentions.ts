export function normalizeMarkdownMentions(value: string) {
  return value
    .replace(/\[@\s*label="([^"]+)"[^\]]*\]/g, '@$1')
    .replace(/\[@[^\]]+\]\(https?:\/\/github\.com\/([^/)]+)\/?\)/g, '@$1')
}
