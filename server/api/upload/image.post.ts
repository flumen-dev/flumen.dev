import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { getSessionToken } from '~~/server/utils/github'

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
  await getSessionToken(event)

  const form = await readMultipartFormData(event)
  if (!form?.length) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  const file = form.find(f => f.name === 'file')
  if (!file?.data || !file.type) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  const validation = validateImageFile(file as { data: Buffer, type: string })
  if (!validation.valid) {
    throw createError({ statusCode: 400, message: validation.message })
  }

  const bucket = process.env.R2_BUCKET
  const publicUrl = process.env.R2_PUBLIC_URL

  if (!bucket || !publicUrl) {
    throw createError({ statusCode: 503, message: 'Image upload is not configured' })
  }

  const ext = imageExtFromType(file.type)
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
