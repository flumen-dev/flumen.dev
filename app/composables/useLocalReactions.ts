import type { ReactionGroup } from '~~/shared/types/issue-detail'

/**
 * Manages local reaction state with optimistic updates.
 * Syncs with source prop via watch so a full refresh replaces local state.
 */
export function useLocalReactions(source: Ref<ReactionGroup[]>) {
  const localReactions = ref<ReactionGroup[]>([...source.value])

  watch(source, (newVal) => {
    localReactions.value = [...newVal]
  })

  function onToggle(content: string, added: boolean) {
    const idx = localReactions.value.findIndex(r => r.content === content)
    if (added && idx === -1) {
      localReactions.value.push({ content, count: 1, viewerHasReacted: true })
    }
    else if (added && idx >= 0) {
      localReactions.value[idx] = { ...localReactions.value[idx]!, count: localReactions.value[idx]!.count + 1, viewerHasReacted: true }
    }
    else if (!added && idx >= 0) {
      const current = localReactions.value[idx]!
      if (current.count <= 1) {
        localReactions.value.splice(idx, 1)
      }
      else {
        localReactions.value[idx] = { ...current, count: current.count - 1, viewerHasReacted: false }
      }
    }
  }

  return { localReactions, onToggle }
}
