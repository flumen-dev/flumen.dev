import { runSharedRepoMaintenanceCycle } from '~~/server/utils/shared-repo-data'

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
