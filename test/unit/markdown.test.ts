import { describe, expect, it } from 'vitest'
import { toggleTaskInMarkdown } from '../../app/utils/taskListExtension'
import { linkifyMentions } from '../../app/utils/linkExtension'
import { normalizeMarkdownMentions } from '../../app/utils/normalizeMarkdownMentions'

describe('toggleTaskInMarkdown', () => {
  it('toggles unchecked to checked by index', () => {
    const md = '- [ ] First\n- [ ] Second\n- [ ] Third'
    expect(toggleTaskInMarkdown(md, 1)).toBe('- [ ] First\n- [x] Second\n- [ ] Third')
  })

  it('toggles checked to unchecked', () => {
    const md = '- [x] Done\n- [ ] Pending'
    expect(toggleTaskInMarkdown(md, 0)).toBe('- [ ] Done\n- [ ] Pending')
  })

  it('handles uppercase X', () => {
    const md = '- [X] Done'
    expect(toggleTaskInMarkdown(md, 0)).toBe('- [ ] Done')
  })

  it('leaves non-targeted checkboxes unchanged', () => {
    const md = '- [x] A\n- [ ] B\n- [x] C'
    const result = toggleTaskInMarkdown(md, 2)
    expect(result).toBe('- [x] A\n- [ ] B\n- [ ] C')
  })

  it('handles indented task items', () => {
    const md = '  - [ ] Indented'
    expect(toggleTaskInMarkdown(md, 0)).toBe('  - [x] Indented')
  })

  it('does nothing for out-of-range index', () => {
    const md = '- [ ] Only one'
    expect(toggleTaskInMarkdown(md, 5)).toBe(md)
  })

  it('handles mixed content with non-task items', () => {
    const md = '- normal item\n- [ ] task\n- another normal'
    expect(toggleTaskInMarkdown(md, 0)).toBe('- normal item\n- [x] task\n- another normal')
  })
})

describe('linkifyMentions', () => {
  it('converts @mention to GitHub link', () => {
    expect(linkifyMentions('Hello @alice')).toBe('Hello [@alice](https://github.com/alice)')
  })

  it('handles mention with hyphens', () => {
    expect(linkifyMentions('cc @some-user')).toBe('cc [@some-user](https://github.com/some-user)')
  })

  it('does not linkify already-linked mentions', () => {
    const md = '[@alice](https://github.com/alice)'
    expect(linkifyMentions(md)).toBe(md)
  })

  it('handles multiple mentions', () => {
    const result = linkifyMentions('@alice and @bob')
    expect(result).toContain('[@alice](https://github.com/alice)')
    expect(result).toContain('[@bob](https://github.com/bob)')
  })

  it('does not linkify email addresses', () => {
    const md = 'Contact user@example.com'
    expect(linkifyMentions(md)).toBe(md)
  })

  it('handles mention at start of line', () => {
    expect(linkifyMentions('@admin please review')).toBe('[@admin](https://github.com/admin) please review')
  })

  it('handles mention at end of string', () => {
    expect(linkifyMentions('Thanks @reviewer')).toBe('Thanks [@reviewer](https://github.com/reviewer)')
  })
})

describe('normalizeMarkdownMentions', () => {
  it('normalizes label-style mention syntax', () => {
    const value = 'Hey [@ label="Gonzo17"] please check this'
    expect(normalizeMarkdownMentions(value)).toBe('Hey @Gonzo17 please check this')
  })

  it('normalizes markdown link mentions', () => {
    const value = 'Hello [@alice](https://github.com/alice)'
    expect(normalizeMarkdownMentions(value)).toBe('Hello @alice')
  })

  it('keeps regular text untouched', () => {
    const value = 'No mention syntax here'
    expect(normalizeMarkdownMentions(value)).toBe(value)
  })
})
