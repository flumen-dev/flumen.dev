interface GitHubFormField {
  type: 'markdown' | 'input' | 'textarea' | 'dropdown' | 'checkboxes'
  id?: string
  attributes: Record<string, unknown>
}

/**
 * Converts Vorm form data back to GitHub-compatible markdown.
 * Follows GitHub's own format for rendering form submissions.
 */
export function formDataToMarkdown(
  fields: GitHubFormField[],
  formData: Record<string, unknown>,
): string {
  const sections: string[] = []

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]!
    const name = field.id || `field_${i}`
    const attrs = field.attributes

    switch (field.type) {
      case 'markdown':
        // Markdown blocks are not included in the submission body
        break

      case 'input':
      case 'textarea':
        {
          const value = String(formData[name] ?? '').trim()
          if (value) {
            const label = String(attrs.label ?? name)
            const render = field.type === 'textarea' && attrs.render
              ? String(attrs.render)
              : null
            if (render) {
              sections.push(`### ${label}\n\n\`\`\`${render}\n${value}\n\`\`\``)
            }
            else {
              sections.push(`### ${label}\n\n${value}`)
            }
          }
        }
        break

      case 'dropdown':
        {
          const value = String(formData[name] ?? '').trim()
          if (value) {
            const label = String(attrs.label ?? name)
            sections.push(`### ${label}\n\n${value}`)
          }
        }
        break

      case 'checkboxes':
        {
          const options = Array.isArray(attrs.options) ? attrs.options : []
          const label = String(attrs.label ?? name)

          if (options.length > 1) {
            const lines = options.map((opt: { label: string }, j: number) => {
              const checked = formData[`${name}_${j}`] === true
              return `- [${checked ? 'x' : ' '}] ${opt.label}`
            })
            sections.push(`### ${label}\n\n${lines.join('\n')}`)
          }
          else {
            const checked = formData[name] === true
            const optLabel = options[0]?.label ?? label
            sections.push(`### ${label}\n\n- [${checked ? 'x' : ' '}] ${optLabel}`)
          }
        }
        break
    }
  }

  return sections.join('\n\n')
}
