import { describe, expect, it } from 'vitest'
import { githubFormToVorm } from '../../shared/utils/github-form-to-vorm'

describe('githubFormToVorm', () => {
  it('converts input and textarea fields to Vorm schema', () => {
    const { schema } = githubFormToVorm([
      { type: 'input', id: 'title', attributes: { label: 'Title', placeholder: 'Enter title' }, validations: { required: true } },
      { type: 'textarea', id: 'body', attributes: { label: 'Description' } },
    ])

    expect(schema).toHaveLength(2)
    expect(schema[0]!.name).toBe('title')
    expect(schema[0]!.type).toBe('text')
    expect(schema[0]!.label).toBe('Title *')
    expect(schema[0]!.validation).toEqual([{ rule: 'required' }])
    expect(schema[1]!.name).toBe('body')
    expect(schema[1]!.type).toBe('textarea')
  })

  it('extracts markdown blocks with correct position index', () => {
    const { schema, markdownBlocks } = githubFormToVorm([
      { type: 'markdown', attributes: { value: '## Instructions' } },
      { type: 'input', id: 'name', attributes: { label: 'Name' } },
      { type: 'markdown', attributes: { value: '## Details' } },
      { type: 'textarea', id: 'details', attributes: { label: 'Details' } },
    ])

    expect(schema).toHaveLength(2)
    expect(markdownBlocks).toHaveLength(2)
    // First markdown is before schema index 0 (no fields yet)
    expect(markdownBlocks[0]!.index).toBe(0)
    expect(markdownBlocks[0]!.content).toBe('## Instructions')
    // Second markdown is before schema index 1 (one field pushed)
    expect(markdownBlocks[1]!.index).toBe(1)
    expect(markdownBlocks[1]!.content).toBe('## Details')
  })

  it('trailing markdown blocks get index >= schema.length', () => {
    const { schema, markdownBlocks } = githubFormToVorm([
      { type: 'input', id: 'name', attributes: { label: 'Name' } },
      { type: 'markdown', attributes: { value: 'Footer note' } },
    ])

    expect(schema).toHaveLength(1)
    expect(markdownBlocks).toHaveLength(1)
    expect(markdownBlocks[0]!.index).toBe(schema.length)
  })
})
