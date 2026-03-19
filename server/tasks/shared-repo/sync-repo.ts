import { runSharedRepoSyncForRepo } from '~~/server/utils/repo-sync-service'

interface SyncRepoTaskPayload {
  owner?: string
  repo?: string
  reason?: string
}

export default defineTask({
  meta: {
    name: 'shared-repo:sync-repo',
    description: 'Run immediate shared repo sync for a single repository',
  },
  async run({ payload }: { payload?: SyncRepoTaskPayload }) {
    const owner = payload?.owner
    const repo = payload?.repo
    const reason = payload?.reason ?? 'on-demand'

    if (!owner || !repo) {
      throw new Error('Invalid payload: owner and repo are required')
    }

    console.log('[task:shared-repo:sync-repo] Starting', { owner, repo, reason })
    const startedAt = Date.now()
    await runSharedRepoSyncForRepo(owner, repo, reason)
    const elapsedMs = Date.now() - startedAt
    console.log('[task:shared-repo:sync-repo] Completed', { owner, repo, reason, elapsedMs })

    return {
      result: {
        owner,
        repo,
        reason,
      },
    }
  },
})
