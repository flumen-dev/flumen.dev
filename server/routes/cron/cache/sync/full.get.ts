import { runSharedRepoMaintenanceCycle } from '~~/server/utils/repo-sync-service'
import { assertCronSecret } from '~~/server/utils/cron-auth'

export default defineEventHandler(async (event) => {
  assertCronSecret(event)

  console.log('[route:cron:shared-repo-warm] starting')
  const startedAt = Date.now()
  const result = await runSharedRepoMaintenanceCycle()
  const elapsedMs = Date.now() - startedAt
  console.log('[route:cron:shared-repo-warm] completed', {
    elapsedMs,
    inspected: result.inspected,
    warmed: result.warmed,
    skipped: result.skipped,
  })

  return { ok: true, elapsedMs, ...result }
})
