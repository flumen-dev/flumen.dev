export interface HighlightPart {
  text: string
  match: boolean
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Splits `text` into segments, marking parts that match any whitespace-separated
 * token from `query` (case-insensitive). Use to render highlighted matches.
 */
export function highlightMatches(text: string, query: string | undefined | null): HighlightPart[] {
  if (!text) return []
  const trimmed = query?.trim()
  if (!trimmed) return [{ text, match: false }]

  const tokens = trimmed.split(/\s+/).filter(Boolean).map(escapeRegex)
  if (!tokens.length) return [{ text, match: false }]

  const re = new RegExp(`(${tokens.join('|')})`, 'gi')
  const parts: HighlightPart[] = []
  let lastIndex = 0

  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0
    if (start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, start), match: false })
    }
    parts.push({ text: match[0], match: true })
    lastIndex = start + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), match: false })
  }
  return parts
}
