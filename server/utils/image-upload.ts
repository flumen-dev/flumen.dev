export const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB

export function validateImageFile(file: { data: Buffer, type?: string }): { valid: true } | { valid: false, message: string } {
  if (!file.data || !file.type) {
    return { valid: false, message: 'No file provided' }
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { valid: false, message: `Unsupported file type: ${file.type}` }
  }

  if (file.data.length > MAX_IMAGE_SIZE) {
    return { valid: false, message: 'File too large (max 5 MB)' }
  }

  return { valid: true }
}

export function imageExtFromType(type: string): string {
  return type.split('/')[1] ?? 'png'
}
