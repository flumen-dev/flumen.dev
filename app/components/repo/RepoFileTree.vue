<script setup lang="ts">
import type { RepoTreeEntry } from '~~/shared/types/repository'

const props = defineProps<{
  entries: RepoTreeEntry[]
}>()

const emit = defineEmits<{
  navigate: [path: string]
}>()

function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sortEntries(entries: RepoTreeEntry[]): RepoTreeEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

const sortedEntries = computed(() => sortEntries(props.entries))
</script>

<template>
  <div class="divide-y divide-default">
    <button
      v-for="entry in sortedEntries"
      :key="entry.path"
      class="flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-elevated transition-colors cursor-pointer"
      @click="emit('navigate', entry.path)"
    >
      <UIcon
        :name="entry.type === 'dir' ? 'i-lucide-folder' : 'i-lucide-file'"
        class="size-4 shrink-0"
        :class="entry.type === 'dir' ? 'text-blue-400' : 'text-muted'"
      />
      <span
        class="text-sm truncate flex-1"
        :class="entry.type === 'dir' ? 'text-highlighted' : 'text-muted'"
      >
        {{ entry.name }}
      </span>
      <span
        v-if="entry.type === 'file' && entry.size"
        class="text-xs text-dimmed shrink-0"
      >
        {{ formatSize(entry.size) }}
      </span>
    </button>
  </div>
</template>
