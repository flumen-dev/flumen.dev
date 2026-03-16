import { runSharedRepoMaintenanceCycle } from '~~/server/utils/repo-sync-service'

export default defineTask({
  meta: {
    name: 'shared-repo:warm-cache',
    description: 'Refresh active shared repository caches',
  },
  async run() {
    const result = await runSharedRepoMaintenanceCycle()
    return { result }
  },
})
