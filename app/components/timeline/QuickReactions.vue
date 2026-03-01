<script lang="ts" setup>
const props = defineProps<{
  subjectId: string
  repo: string
  issueNumber: number
  pullCommentId?: number
  workItemId?: string
  reactions?: { content: string, count: number, viewerHasReacted: boolean }[]
}>()

const emit = defineEmits<{
  toggle: [content: string, added: boolean]
}>()

const { t } = useI18n()
const apiFetch = useRequestFetch()
const toast = useToast()
const pending = ref<string | null>(null)

const quickEmojis: { key: string, emoji: string, label: string }[] = [
  { key: 'THUMBS_UP', emoji: '\uD83D\uDC4D', label: 'thumbs up' },
  { key: 'THUMBS_DOWN', emoji: '\uD83D\uDC4E', label: 'thumbs down' },
  { key: 'LAUGH', emoji: '\uD83D\uDE04', label: 'laugh' },
  { key: 'HOORAY', emoji: '\uD83C\uDF89', label: 'hooray' },
  { key: 'HEART', emoji: '\u2764\uFE0F', label: 'heart' },
  { key: 'ROCKET', emoji: '\uD83D\uDE80', label: 'rocket' },
]

function isReacted(key: string) {
  return props.reactions?.some(r => r.content === key && r.viewerHasReacted) ?? false
}

async function toggle(key: string) {
  if (pending.value) return
  pending.value = key

  const currentlyReacted = isReacted(key)

  try {
    await apiFetch('/api/issues/reactions', {
      method: 'POST',
      body: {
        subjectId: props.subjectId,
        content: key,
        remove: currentlyReacted,
        repo: props.repo,
        issueNumber: props.issueNumber,
        pullCommentId: props.pullCommentId,
        workItemId: props.workItemId,
      },
    })
    emit('toggle', key, !currentlyReacted)
  }
  catch {
    toast.add({ title: t('issues.comment.reactionError'), color: 'error' })
  }
  finally {
    pending.value = null
  }
}
</script>

<template>
  <div class="flex items-center gap-0.5 rounded-full border border-default bg-default/90 backdrop-blur-sm px-1 py-0.5 shadow-sm">
    <button
      v-for="{ key, emoji, label } in quickEmojis"
      :key="key"
      type="button"
      :aria-label="`React with ${label}`"
      class="rounded-full p-1 text-sm leading-none transition-all cursor-pointer"
      :class="[
        isReacted(key)
          ? 'bg-primary/15 scale-110'
          : 'hover:bg-elevated hover:scale-110',
        pending === key ? 'opacity-50' : '',
      ]"
      :disabled="pending === key"
      @click.stop="toggle(key)"
    >
      {{ emoji }}
    </button>
  </div>
</template>
