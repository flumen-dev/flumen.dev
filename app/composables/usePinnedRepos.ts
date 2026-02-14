export function usePinnedRepos() {
  const { settings, update } = useUserSettings()

  const pinnedRepos = computed(() => settings.value?.pinnedRepos ?? [])

  function isPinned(repo: string) {
    return pinnedRepos.value.includes(repo)
  }

  async function pin(repo: string) {
    if (isPinned(repo)) return
    await update({ pinnedRepos: [...pinnedRepos.value, repo] })
  }

  async function unpin(repo: string) {
    await update({ pinnedRepos: pinnedRepos.value.filter(r => r !== repo) })
  }

  async function toggle(repo: string) {
    if (isPinned(repo)) await unpin(repo)
    else await pin(repo)
  }

  return { pinnedRepos, isPinned, pin, unpin, toggle }
}
