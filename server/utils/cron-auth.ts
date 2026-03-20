import type { H3Event } from 'h3'

export function getCronSecret(): string | null {
  const envCronSecret = process.env.CRON_SECRET?.trim()
  if (envCronSecret) return envCronSecret

  const runtime = useRuntimeConfig()
  const secret = (runtime.cronSecret as string | undefined)?.trim()
    ?? process.env.NUXT_CRON_SECRET?.trim()
  return secret || null
}

export function assertCronSecret(event: H3Event): void {
  const cronSecret = getCronSecret()
  if (!cronSecret) {
    throw createError({ statusCode: 503, message: 'CRON_SECRET not configured' })
  }

  const auth = getHeader(event, 'authorization')
  const headerSecret = getHeader(event, 'x-cron-secret')
  const bearerMatches = auth === `Bearer ${cronSecret}`
  const headerMatches = headerSecret === cronSecret

  if (!bearerMatches && !headerMatches) {
    console.warn('[repo-sync] cron auth mismatch', {
      hasAuthorizationHeader: Boolean(auth),
      hasCronSecretHeader: Boolean(headerSecret),
    })
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
}
