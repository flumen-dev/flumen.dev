import type { PinnedItem, PinnedItemType } from '~~/shared/types/settings'

export function usePinnedRepos() {
  const { settings, update } = useUserSettings()

  const pinnedRepos = computed(() => settings.value?.pinnedRepos ?? [])

  function isPinned(repo: string) {
    return pinnedRepos.value.some(p => p.repo === repo)
  }

  function getItem(repo: string): PinnedItem | undefined {
    return pinnedRepos.value.find(p => p.repo === repo)
  }

  async function pin(repo: string, type: PinnedItemType = 'repo') {
    if (isPinned(repo)) return
    await update({ pinnedRepos: [...pinnedRepos.value, { repo, type }] })
  }

  async function unpin(repo: string) {
    await update({ pinnedRepos: pinnedRepos.value.filter(p => p.repo !== repo) })
  }

  async function toggle(repo: string, type: PinnedItemType = 'repo') {
    if (isPinned(repo)) await unpin(repo)
    else await pin(repo, type)
  }

  return { pinnedRepos, isPinned, getItem, pin, unpin, toggle }
}
