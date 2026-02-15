import type { VormSchema } from 'vorm-vue'

interface GitHubFormField {
  type: 'markdown' | 'input' | 'textarea' | 'dropdown' | 'checkboxes'
  id?: string
  attributes: Record<string, unknown>
  validations?: { required?: boolean }
}

export interface MarkdownBlock {
  /** Position index in the original body array */
  index: number
  content: string
}

export interface TransformResult {
  schema: VormSchema
  markdownBlocks: MarkdownBlock[]
  initialData: Record<string, unknown>
}

const fieldClasses = {
  outer: 'space-y-2',
  label: 'text-sm font-semibold text-highlighted',
  help: 'text-xs text-muted',
}

const checkboxClasses = {
  outer: '',
  label: '',
  help: '',
}

/**
 * Converts a GitHub issue form `body[]` to a Vorm schema.
 * Markdown blocks are returned separately since they're not form fields.
 * Initial values are returned as `initialData` for `useVorm(schema, { initialData })`.
 */
export function githubFormToVorm(fields: GitHubFormField[]): TransformResult {
  const schema: VormSchema = []
  const markdownBlocks: MarkdownBlock[] = []
  const initialData: Record<string, unknown> = {}

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]!
    const name = field.id || `field_${i}`
    const attrs = field.attributes
    const required = field.validations?.required === true

    switch (field.type) {
      case 'markdown':
        markdownBlocks.push({
          index: schema.length,
          content: String(attrs.value ?? ''),
        })
        break

      case 'input':
        schema.push({
          name,
          type: 'text',
          label: String(attrs.label ?? '') + (required ? ' *' : ''),
          placeholder: String(attrs.placeholder ?? ''),
          helpText: String(attrs.description ?? ''),
          classes: fieldClasses,
          validation: required ? [{ rule: 'required' as const }] : [],
        })
        if (attrs.value) initialData[name] = String(attrs.value)
        break

      case 'textarea':
        schema.push({
          name,
          type: 'textarea',
          label: String(attrs.label ?? '') + (required ? ' *' : ''),
          placeholder: String(attrs.placeholder ?? ''),
          helpText: String(attrs.description ?? ''),
          classes: fieldClasses,
          validation: required ? [{ rule: 'required' as const }] : [],
        })
        if (attrs.value) initialData[name] = String(attrs.value)
        break

      case 'dropdown':
        {
          const options = Array.isArray(attrs.options)
            ? attrs.options.map((opt: string) => ({ label: String(opt), value: String(opt) }))
            : []
          const defaultIdx = typeof attrs.default === 'number' ? attrs.default : undefined

          schema.push({
            name,
            type: 'select',
            label: String(attrs.label ?? '') + (required ? ' *' : ''),
            helpText: String(attrs.description ?? ''),
            options,
            classes: fieldClasses,
            validation: required ? [{ rule: 'required' as const }] : [],
          })
          const defaultValue = defaultIdx !== undefined && options[defaultIdx]
            ? options[defaultIdx].value
            : options[0]?.value ?? ''
          if (defaultValue) {
            initialData[name] = defaultValue
          }
        }
        break

      case 'checkboxes':
        {
          const checkboxOptions = Array.isArray(attrs.options) ? attrs.options : []

          if (checkboxOptions.length > 1) {
            for (let j = 0; j < checkboxOptions.length; j++) {
              const opt = checkboxOptions[j] as { label: string, required?: boolean }
              const fieldName = `${name}_${j}`
              schema.push({
                name: fieldName,
                type: 'checkbox',
                label: String(opt.label ?? ''),
                classes: checkboxClasses,
                validation: opt.required ? [{ rule: 'required' as const }] : [],
              })
              initialData[fieldName] = false
            }
          }
          else {
            schema.push({
              name,
              type: 'checkbox',
              label: String(checkboxOptions[0]?.label ?? attrs.label ?? ''),
              classes: checkboxClasses,
            })
            initialData[name] = false
          }
        }
        break
    }
  }

  return { schema, markdownBlocks, initialData }
}
