import { describe, expect, it } from 'vitest'
import { validateImageFile, imageExtFromType, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '../../server/utils/image-upload'

describe('validateImageFile', () => {
  it('accepts valid image types', () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      const result = validateImageFile({ data: Buffer.from('x'), type })
      expect(result.valid, `expected ${type} to be valid`).toBe(true)
    }
  })

  it('rejects unsupported file types', () => {
    const result = validateImageFile({ data: Buffer.from('x'), type: 'application/pdf' })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.message).toContain('Unsupported file type')
    }
  })

  it('rejects files exceeding 5 MB', () => {
    const oversized = Buffer.alloc(MAX_IMAGE_SIZE + 1)
    const result = validateImageFile({ data: oversized, type: 'image/png' })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.message).toContain('too large')
    }
  })

  it('accepts files exactly at the size limit', () => {
    const exact = Buffer.alloc(MAX_IMAGE_SIZE)
    const result = validateImageFile({ data: exact, type: 'image/png' })
    expect(result.valid).toBe(true)
  })
})

describe('imageExtFromType', () => {
  it('extracts extension from mime type', () => {
    expect(imageExtFromType('image/png')).toBe('png')
    expect(imageExtFromType('image/jpeg')).toBe('jpeg')
    expect(imageExtFromType('image/webp')).toBe('webp')
    expect(imageExtFromType('image/gif')).toBe('gif')
  })

  it('rejects SVG to prevent XSS', () => {
    const result = validateImageFile({ data: Buffer.from('x'), type: 'image/svg+xml' })
    expect(result.valid).toBe(false)
  })
})
