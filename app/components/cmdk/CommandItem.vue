<script setup lang="ts">
import type { CmdkResult } from '~/stores/cmdk'
import HighlightedText from './HighlightedText.vue'

defineProps<{
  result: CmdkResult
  selected: boolean
}>()

defineEmits<{
  select: []
  highlight: []
}>()

const cmdk = useCmdkStore()
</script>

<template>
  <button
    :id="`cmdk-result-${result.id}`"
    type="button"
    role="option"
    :aria-selected="selected"
    :data-cmdk-selected="selected"
    class="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
    :class="selected ? 'bg-elevated' : 'hover:bg-elevated/50'"
    @click="$emit('select')"
    @mouseenter="$emit('highlight')"
  >
    <div class="shrink-0 size-6 flex items-center justify-center">
      <NuxtImg
        v-if="result.avatarUrl"
        :src="result.avatarUrl"
        :alt="result.title"
        width="24"
        height="24"
        class="size-6 rounded"
      />
      <UIcon
        v-else-if="result.iconKey"
        :name="result.iconKey"
        class="size-5 text-muted"
      />
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-sm text-default truncate">
        <HighlightedText
          :text="result.title"
          :query="cmdk.query"
        />
      </div>
      <div
        v-if="result.subtitle"
        class="text-xs text-muted truncate"
      >
        <HighlightedText
          :text="result.subtitle"
          :query="cmdk.query"
        />
      </div>
    </div>
    <span
      v-if="result.badge"
      class="text-xs text-muted shrink-0"
    >
      {{ result.badge }}
    </span>
  </button>
</template>
