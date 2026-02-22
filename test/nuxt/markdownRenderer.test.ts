import { describe, expect, it } from 'vitest'
import { renderMarkdown, rewriteRelativeUrls } from '../../app/utils/markdownRenderer'

describe('renderMarkdown', () => {
  it('renders bold and italic', () => {
    const html = renderMarkdown('**bold** and *italic*')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('renders headings', () => {
    const html = renderMarkdown('## Heading')
    expect(html).toContain('<h2>Heading</h2>')
  })

  it('renders external links with target="_blank"', () => {
    const html = renderMarkdown('[link](https://example.com)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('href="https://example.com"')
  })

  it('renders internal links without target="_blank"', () => {
    const html = renderMarkdown('[link](/path)')
    expect(html).not.toContain('target="_blank"')
  })

  it('adds reproduction-link class for sandbox URLs', () => {
    const html = renderMarkdown('[repro](https://stackblitz.com/edit/test)')
    expect(html).toContain('class="reproduction-link"')
  })

  it('renders images', () => {
    const html = renderMarkdown('![alt](https://example.com/img.png)')
    expect(html).toContain('<img')
    expect(html).toContain('src="https://example.com/img.png"')
    expect(html).toContain('alt="alt"')
  })

  it('renders linked images (badges)', () => {
    const html = renderMarkdown('[![badge](https://img.shields.io/badge/test)](https://example.com)')
    expect(html).toContain('<a')
    expect(html).toContain('<img')
    expect(html).toContain('href="https://example.com"')
  })

  it('renders bold inside links', () => {
    const html = renderMarkdown('[**bold link**](https://example.com)')
    expect(html).toContain('<strong>bold link</strong>')
    expect(html).toContain('<a')
  })

  it('renders bold inside list items', () => {
    const html = renderMarkdown('- **Frontend:** Vue.js')
    expect(html).toContain('<strong>Frontend:</strong>')
    expect(html).toContain('<li>')
  })

  it('renders task list with custom checkbox', () => {
    const html = renderMarkdown('- [x] Done\n- [ ] Pending')
    expect(html).toContain('class="task-list"')
    expect(html).toContain('class="task-checkbox"')
    expect(html).toContain('data-task="checked"')
    expect(html).toContain('data-task="unchecked"')
  })

  it('renders only one checkbox per task item', () => {
    const html = renderMarkdown('- [x] Task')
    const checkboxCount = (html.match(/<input/g) || []).length
    expect(checkboxCount).toBe(1)
  })

  it('treats line breaks as <br> by default', () => {
    const html = renderMarkdown('line1\nline2')
    expect(html).toContain('<br>')
  })

  it('ignores line breaks when breaks=false', () => {
    const html = renderMarkdown('line1\nline2', false)
    expect(html).not.toContain('<br>')
  })

  it('strips script tags (XSS)', () => {
    const html = renderMarkdown('<script>alert("xss")</script>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert')
  })

  it('strips onerror attributes (XSS)', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">')
    expect(html).not.toContain('onerror')
  })

  it('renders code blocks', () => {
    const html = renderMarkdown('```js\nconst x = 1\n```')
    expect(html).toContain('<pre>')
    expect(html).toContain('const x = 1')
  })

  it('renders tables', () => {
    const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>')
    expect(html).toContain('<td>')
  })
})

describe('rewriteRelativeUrls', () => {
  it('rewrites markdown image paths to raw proxy URLs', () => {
    const source = '![logo](./assets/logo.svg)'
    const output = rewriteRelativeUrls(source, '/api/repository/acme/demo/raw')
    expect(output).toContain('![logo](/api/repository/acme/demo/raw?path=assets%2Flogo.svg)')
  })

  it('rewrites html img src paths to raw proxy URLs', () => {
    const source = '<img src="images/banner.png" alt="banner">'
    const output = rewriteRelativeUrls(source, '/api/repository/acme/demo/raw')
    expect(output).toContain('<img src="/api/repository/acme/demo/raw?path=images%2Fbanner.png"')
  })

  it('keeps absolute and hash URLs unchanged', () => {
    const source = '![cdn](https://example.com/a.png) ![anchor](#section)'
    const output = rewriteRelativeUrls(source, '/api/repository/acme/demo/raw')
    expect(output).toContain('![cdn](https://example.com/a.png)')
    expect(output).toContain('![anchor](#section)')
  })
})
