<script setup lang="ts">
import type { RecentItem } from '~~/shared/types/recent'
import { buildWorkItemPath } from '~/utils/workItemPath'

const props = defineProps<{
  item: RecentItem
  dragging: boolean
  variant: 'favorite' | 'recent'
}>()

const emit = defineEmits<{
  'toggle-favorite': []
  'remove': []
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const recentStore = useRecentStore()
const toast = useToast()

const isFavorite = computed(() => props.variant === 'favorite')

const workItemPath = computed(() => buildWorkItemPath(props.item.repo, props.item.number))

const link = computed(() => (workItemPath.value ? localePath(workItemPath.value) : props.item.url))

const isExternal = computed(() => !workItemPath.value)

const tooltip = computed(() => {
  const base = `${props.item.repo}#${props.item.number}`
  if (props.item.previousTitle) {
    return `${base} — "${props.item.previousTitle}"\n${t('focus.recent.renamed', { title: `"${props.item.title}"` })}`
  }
  return `${props.item.title} — ${base}`
})

const contextMenuItems = computed(() => {
  const nav = [
    {
      label: t('focus.recent.openNewTab'),
      icon: 'i-lucide-external-link',
      onSelect: () => window.open(link.value, '_blank', 'noopener,noreferrer'),
    },
    {
      label: t('focus.recent.openGithub'),
      icon: 'i-simple-icons-github',
      onSelect: () => window.open(props.item.url, '_blank', 'noopener,noreferrer'),
    },
    {
      label: t('common.copyLink'),
      icon: 'i-lucide-link',
      onSelect: async () => {
        try {
          await navigator.clipboard.writeText(props.item.url)
          toast.add({ title: t('common.copied'), color: 'success' })
        }
        catch {
          toast.add({ title: t('common.copyFailed'), color: 'error' })
        }
      },
    },
  ]

  const fav = isFavorite.value
    ? [{
        label: t('focus.recent.unfavorite'),
        icon: 'i-lucide-star-off',
        onSelect: () => emit('toggle-favorite'),
      }]
    : [{
        label: t('focus.recent.favorite'),
        icon: 'i-lucide-star',
        onSelect: () => emit('toggle-favorite'),
      }]

  const danger = [{
    label: t('focus.recent.remove'),
    icon: 'i-lucide-trash-2',
    color: 'error' as const,
    onSelect: () => emit('remove'),
  }]

  return [nav, fav, danger]
})
</script>

<template>
  <UContextMenu :items="contextMenuItems">
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
          :external="isExternal"
          :target="isExternal ? '_blank' : undefined"
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
  </UContextMenu>
</template>
