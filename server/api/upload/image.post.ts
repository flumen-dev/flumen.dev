import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { getSessionToken } from '~~/server/utils/github'

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'])
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

let s3: S3Client | null = null

function getS3Client(): S3Client {
  if (s3) return s3

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw createError({ statusCode: 503, message: 'Image upload is not configured' })
  }

  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  return s3
}

export default defineEventHandler(async (event) => {
  // Auth check
  await getSessionToken(event)

  const form = await readMultipartFormData(event)
  if (!form?.length) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  const file = form.find(f => f.name === 'file')
  if (!file?.data || !file.type) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    throw createError({ statusCode: 400, message: `Unsupported file type: ${file.type}` })
  }

  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: 'File too large (max 5 MB)' })
  }

  const bucket = process.env.R2_BUCKET
  const publicUrl = process.env.R2_PUBLIC_URL

  if (!bucket || !publicUrl) {
    throw createError({ statusCode: 503, message: 'Image upload is not configured' })
  }

  const ext = file.type.split('/')[1]?.replace('svg+xml', 'svg') ?? 'png'
  const key = `${randomUUID()}.${ext}`

  await getS3Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.data,
    ContentType: file.type,
  }))

  return {
    url: `${publicUrl}/${key}`,
  }
})
