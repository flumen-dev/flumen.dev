export interface LogSection {
  name: string
  lines: string[]
  collapsed: boolean
}

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/

export function parseActionsLog(raw: string): LogSection[] {
  if (!raw.trim()) return []
  const lines = raw.split('\n')
  const sections: LogSection[] = []
  let current: LogSection | null = null

  for (const rawLine of lines) {
    const line = rawLine.replace(TIMESTAMP_RE, '')

    if (line.startsWith('##[group]')) {
      if (current) sections.push(current)
      current = { name: line.replace('##[group]', ''), lines: [], collapsed: true }
      continue
    }

    if (line.startsWith('##[endgroup]')) {
      if (current) {
        sections.push(current)
        current = null
      }
      continue
    }

    // Skip other ##[] directives
    if (line.startsWith('##[')) continue

    if (current) {
      current.lines.push(line)
    }
    else {
      // Lines outside groups go into a default section
      if (!sections.length || sections[sections.length - 1]!.collapsed) {
        sections.push({ name: '', lines: [], collapsed: false })
      }
      sections[sections.length - 1]!.lines.push(line)
    }
  }

  if (current) sections.push(current)

  return sections.filter(s => s.lines.length > 0 || s.name)
}
