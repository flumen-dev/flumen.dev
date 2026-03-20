import type { H3Event } from 'h3'

export function getCronSecret(): string | null {
  const runtime = useRuntimeConfig()
  const secret = (runtime.cronSecret as string | undefined)?.trim()
    ?? process.env.NUXT_CRON_SECRET?.trim()
    ?? process.env.CRON_SECRET?.trim()
  return secret || null
}

export function assertCronSecret(event: H3Event): void {
  const cronSecret = getCronSecret()
  if (!cronSecret) {
    throw createError({ statusCode: 503, message: 'CRON_SECRET not configured' })
  }

  const auth = getHeader(event, 'authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
}
