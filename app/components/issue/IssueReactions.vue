<script lang="ts" setup>
import type { ReactionGroup } from '~~/shared/types/issue-detail'

const props = defineProps<{
  reactions: ReactionGroup[]
  subjectId: string
}>()

const emit = defineEmits<{
  toggle: [content: string, added: boolean]
}>()

const apiFetch = useRequestFetch()
const pending = ref<string | null>(null)

const emojiMap: Record<string, string> = {
  THUMBS_UP: '\uD83D\uDC4D',
  THUMBS_DOWN: '\uD83D\uDC4E',
  LAUGH: '\uD83D\uDE04',
  HOORAY: '\uD83C\uDF89',
  CONFUSED: '\uD83D\uDE15',
  HEART: '\u2764\uFE0F',
  ROCKET: '\uD83D\uDE80',
  EYES: '\uD83D\uDC40',
}

const allEmojis = Object.keys(emojiMap)

const availableEmojis = computed(() =>
  allEmojis.filter(e => !props.reactions.some(r => r.content === e)),
)

const toast = useToast()

async function toggle(content: string, currentlyReacted: boolean) {
  if (pending.value) return
  pending.value = content

  try {
    await apiFetch('/api/issues/reactions', {
      method: 'POST',
      body: { subjectId: props.subjectId, content, remove: currentlyReacted },
    })
    emit('toggle', content, !currentlyReacted)
  }
  catch {
    toast.add({ title: 'Could not update reaction', color: 'error' })
  }
  finally {
    pending.value = null
  }
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <button
      v-for="reaction in reactions"
      :key="reaction.content"
      class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer"
      :class="reaction.viewerHasReacted
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-default bg-elevated/50 hover:border-primary/50'"
      :disabled="pending === reaction.content"
      @click="toggle(reaction.content, reaction.viewerHasReacted)"
    >
      {{ emojiMap[reaction.content] ?? reaction.content }}
      <span :class="reaction.viewerHasReacted ? 'text-primary' : 'text-muted'">{{ reaction.count }}</span>
    </button>

    <!-- Add reaction picker -->
    <UPopover v-if="availableEmojis.length > 0">
      <button class="inline-flex items-center rounded-full border border-dashed border-default px-3 py-1 text-xs text-muted hover:border-primary/50 hover:text-highlighted transition-colors cursor-pointer">
        <UIcon
          name="i-lucide-smile-plus"
          class="size-3.5"
        />
      </button>

      <template #content>
        <div class="flex gap-1 p-2">
          <button
            v-for="emoji in availableEmojis"
            :key="emoji"
            class="rounded p-1.5 text-base hover:bg-elevated transition-colors cursor-pointer"
            :disabled="pending === emoji"
            @click="toggle(emoji, false)"
          >
            {{ emojiMap[emoji] }}
          </button>
        </div>
      </template>
    </UPopover>
  </div>
</template>
