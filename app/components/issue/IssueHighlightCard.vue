<script setup lang="ts">
import type { Issue } from '~~/shared/types/issue'
import { buildWorkItemPath } from '~/utils/workItemPath'

defineProps<{
  title: string
  iconKey: string
  iconClass: string
  items: Issue[]
  loading: boolean
  emptyText: string
  totalCount: number | null
  currentPage: number
  totalPages: number
  hasMore: boolean
  hasPrevious: boolean
  paging: 'next' | 'prev' | null
}>()

defineEmits<{
  next: []
  previous: []
}>()

const localePath = useLocalePath()

// Approx. row height: avatar 2xs (~16px) + py-2 (16px) + text line ≈ 32px.
const ROW_HEIGHT_REM = 2
const maxListHeight = computed(() => `${ROW_HEIGHT_REM * HIGHLIGHT_CARD_VISIBLE_ITEMS}rem`)
</script>

<template>
  <section class="rounded-lg border border-default overflow-hidden flex flex-col bg-default">
    <header class="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-elevated/40 border-b border-default">
      <UIcon
        :name="iconKey"
        class="size-4 shrink-0"
        :class="iconClass"
      />
      <span class="text-sm font-medium truncate">{{ title }}</span>
      <span class="text-xs text-muted ml-auto tabular-nums">
        {{ loading ? '…' : (totalCount ?? items.length) }}
      </span>
    </header>

    <div
      v-if="loading && !items.length"
      class="px-3 sm:px-4 py-6 flex items-center justify-center"
    >
      <UIcon
        name="i-lucide-loader"
        class="size-4 text-muted animate-spin"
      />
    </div>

    <ul
      v-else-if="items.length"
      class="divide-y divide-default flex-1 overflow-y-auto"
      :style="{ maxHeight: maxListHeight }"
    >
      <li
        v-for="issue in items"
        :key="issue.id"
        class="group hover:bg-elevated transition-colors"
      >
        <NuxtLink
          :to="localePath(buildWorkItemPath(issue.repository.nameWithOwner, issue.number)!)"
          class="flex items-center gap-2 px-3 sm:px-4 py-2 min-w-0"
        >
          <span class="text-xs text-muted tabular-nums shrink-0">#{{ issue.number }}</span>
          <span class="flex-1 min-w-0 text-sm text-default truncate group-hover:underline">
            {{ issue.title }}
          </span>
          <UAvatar
            :src="issue.author.avatarUrl"
            :alt="issue.author.login"
            size="2xs"
            class="shrink-0"
          />
        </NuxtLink>
      </li>
    </ul>

    <p
      v-else
      class="px-3 sm:px-4 py-4 text-sm text-muted text-center"
    >
      {{ emptyText }}
    </p>

    <footer
      v-if="totalPages > 1"
      class="border-t border-default"
    >
      <UiPaginator
        :current-page="currentPage"
        :total-pages="totalPages"
        :has-more="hasMore"
        :has-previous="hasPrevious"
        :paging="paging"
        @next="$emit('next')"
        @previous="$emit('previous')"
      />
    </footer>
  </section>
</template>
