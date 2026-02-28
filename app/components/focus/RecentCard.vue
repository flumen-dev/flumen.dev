<script setup lang="ts">
import type { RecentItem } from '~~/shared/types/recent'

const props = defineProps<{
  item: RecentItem
  dragging: boolean
  variant: 'favorite' | 'recent'
}>()

const emit = defineEmits<{
  'toggle-favorite': []
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const recentStore = useRecentStore()

const isFavorite = computed(() => props.variant === 'favorite')

const link = computed(() =>
  props.item.type === 'issue'
    ? localePath({ path: `/issues/${props.item.number}`, query: { repo: props.item.repo } })
    : props.item.url,
)

const tooltip = computed(() => {
  const base = `${props.item.repo}#${props.item.number}`
  if (props.item.previousTitle) {
    return `${base} — "${props.item.previousTitle}"\n${t('focus.recent.renamed', { title: `"${props.item.title}"` })}`
  }
  return `${props.item.title} — ${base}`
})
</script>

<template>
  <UTooltip :text="tooltip">
    <div
      class="group relative flex items-start gap-2.5 rounded-lg border p-3 transition-colors"
      :class="[
        dragging ? 'opacity-50' : '',
        isFavorite
          ? 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'
          : 'border-default hover:bg-elevated',
      ]"
    >
      <!-- Unseen / rename indicators -->
      <UIcon
        v-if="item.previousTitle"
        name="i-lucide-pencil"
        class="absolute -top-1 -right-1 size-3 text-amber-400"
      />
      <span
        v-else-if="recentStore.hasUpdate(item)"
        class="absolute -top-1 -right-1 size-2 rounded-full bg-primary"
      />

      <UIcon
        :name="item.type === 'issue' ? 'i-lucide-circle-dot' : 'i-lucide-git-pull-request'"
        class="size-4 mt-0.5 shrink-0"
        :class="item.type === 'issue' ? 'text-emerald-500' : 'text-blue-500'"
      />

      <NuxtLink
        :to="link"
        :external="item.type === 'pr'"
        :target="item.type === 'pr' ? '_blank' : undefined"
        class="min-w-0 flex-1"
        @click="recentStore.markSeen(item.key)"
      >
        <p class="text-sm font-medium text-highlighted truncate">
          {{ item.title }}
        </p>
        <div class="flex items-center gap-1.5 mt-1">
          <span class="text-xs text-dimmed truncate">
            {{ item.repo }}#{{ item.number }}
          </span>
          <span class="text-xs text-dimmed shrink-0 whitespace-nowrap">
            · {{ timeAgo(item.visitedAt) }}
          </span>
        </div>
      </NuxtLink>

      <div class="flex flex-col items-center gap-1 shrink-0">
        <UIcon
          data-freeform-handle
          name="i-lucide-grip-vertical"
          class="size-3.5 text-muted/50 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        />
        <button
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          :aria-label="isFavorite ? t('focus.recent.unfavorite') : t('focus.recent.favorite')"
          @click.prevent="emit('toggle-favorite')"
        >
          <UIcon
            name="i-lucide-star"
            class="size-3.5"
            :class="isFavorite ? 'text-amber-400 hover:text-amber-300' : 'text-muted/50 hover:text-amber-400'"
          />
        </button>
      </div>
    </div>
  </UTooltip>
</template>
