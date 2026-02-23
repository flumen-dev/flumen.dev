/**
 * Proxy raw file content from a GitHub repository.
 * Used to serve images and other assets referenced in README/markdown files.
 * Route: GET /api/repository/:owner/:repo/raw?path=assets/logo.svg
 */

const MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.html': 'application/octet-stream',
  '.htm': 'application/octet-stream',
  '.css': 'text/css',
  '.js': 'application/octet-stream',
  '.mjs': 'application/octet-stream',
  '.md': 'application/octet-stream',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

const UNSAFE_EXTENSIONS = new Set(['.html', '.htm', '.js', '.mjs', '.md'])

function getFileExtension(path: string): string {
  const dotIndex = path.lastIndexOf('.')
  return dotIndex >= 0 ? path.slice(dotIndex).toLowerCase() : ''
}

function getMimeType(path: string): string {
  const ext = getFileExtension(path)
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const path = getQuery(event).path as string

  if (!path) {
    throw createError({ statusCode: 400, message: 'Missing path parameter' })
  }

  const encodedPath = path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw createError({ statusCode: response.status, message: `GitHub API ${response.status}` })
  }

  const contentType = getMimeType(path)
  const ext = getFileExtension(path)
  const filename = path.split('/').pop() || 'download'
  setResponseHeader(event, 'content-type', contentType)
  setResponseHeader(event, 'cache-control', 'public, max-age=300')
  setResponseHeader(event, 'x-content-type-options', 'nosniff')

  if (UNSAFE_EXTENSIONS.has(ext)) {
    setResponseHeader(event, 'content-disposition', `attachment; filename="${filename.replace(/["\\]/g, '_')}"`)
  }

  const body = await response.arrayBuffer()
  return send(event, Buffer.from(body), contentType)
})
