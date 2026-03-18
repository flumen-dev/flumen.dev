import { runSharedRepoMaintenanceCycle } from '~~/server/utils/repo-sync-service'

export default defineTask({
  meta: {
    name: 'shared-repo:warm-cache',
    description: 'Refresh active shared repository caches',
  },
  async run() {
    console.log('[task:shared-repo:warm-cache] Starting maintenance cycle')
    const startedAt = Date.now()
    const result = await runSharedRepoMaintenanceCycle()
    const elapsedMs = Date.now() - startedAt
    console.log('[task:shared-repo:warm-cache] Completed', {
      elapsedMs,
      inspected: result.inspected,
      warmed: result.warmed,
      skipped: result.skipped,
    })
    return { result }
  },
})
