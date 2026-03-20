import { runSharedRepoSyncForRepo } from '~~/server/utils/repo-sync-service'
import { assertCronSecret } from '~~/server/utils/cron-auth'

interface SyncRepoPayload {
  owner?: string
  repo?: string
  reason?: string
}

export default defineEventHandler(async (event) => {
  assertCronSecret(event)

  const body = await readBody<SyncRepoPayload>(event)
  const owner = body?.owner?.trim()
  const repo = body?.repo?.trim()
  const reason = body?.reason ?? 'internal-trigger'

  if (!owner || !repo) {
    throw createError({ statusCode: 400, message: 'owner and repo are required' })
  }

  console.log('[route:internal:shared-repo-sync] starting', { owner, repo, reason })
  const startedAt = Date.now()
  await runSharedRepoSyncForRepo(owner, repo, reason)
  const elapsedMs = Date.now() - startedAt
  console.log('[route:internal:shared-repo-sync] completed', { owner, repo, reason, elapsedMs })

  return { ok: true, owner, repo, reason, elapsedMs }
})
