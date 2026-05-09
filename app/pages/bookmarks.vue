<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  titleKey: 'bookmark.title',
})

const { t } = useI18n()
const localePath = useLocalePath()
const store = useBookmarkStore()
store.loadIfNeeded()

const sections = computed(() => [
  { key: 'issue' as const, label: t('bookmark.section.issues'), icon: 'i-lucide-circle-dot', items: store.byType.issue },
  { key: 'pr' as const, label: t('bookmark.section.pulls'), icon: 'i-lucide-git-pull-request', items: store.byType.pr },
  { key: 'repo' as const, label: t('bookmark.section.repos'), icon: 'i-lucide-folder-git-2', items: store.byType.repo },
])
</script>

<template>
  <div class="p-3 sm:p-4 lg:p-6 space-y-4 w-full">
    <header class="flex items-center gap-2 sticky top-0 z-10 bg-default/80 backdrop-blur-sm py-1 -mx-3 px-3 sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6">
      <UIcon
        name="i-lucide-bookmark-check"
        class="size-5 text-warning shrink-0"
      />
      <h1 class="text-lg font-semibold truncate">
        {{ t('bookmark.title') }}
      </h1>
      <span class="text-sm text-muted">{{ store.items.length }}</span>
    </header>

    <div
      v-if="store.loading && !store.loaded"
      class="text-sm text-muted text-center py-8"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="!store.items.length"
      class="text-sm text-muted text-center py-12 max-w-md mx-auto"
    >
      {{ t('bookmark.empty') }}
    </div>

    <div
      v-else
      class="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 items-start"
    >
      <section
        v-for="section in sections"
        :key="section.key"
        class="rounded-lg border border-default overflow-hidden flex flex-col"
      >
        <header class="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-elevated/40 border-b border-default">
          <UIcon
            :name="section.icon"
            class="size-4 text-muted shrink-0"
          />
          <span class="text-sm font-medium truncate">{{ section.label }}</span>
          <span class="text-xs text-muted ml-auto tabular-nums">{{ section.items.length }}</span>
        </header>
        <p
          v-if="!section.items.length"
          class="px-3 sm:px-4 py-4 text-sm text-muted text-center"
        >
          {{ t('bookmark.sectionEmpty') }}
        </p>
        <ul
          v-else
          class="divide-y divide-default flex-1"
        >
          <li
            v-for="item in section.items"
            :key="item.id"
            class="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 hover:bg-elevated transition-colors min-w-0"
          >
            <UAvatar
              v-if="item.avatarUrl"
              :src="item.avatarUrl"
              :alt="item.repo ?? item.title"
              size="2xs"
              class="shrink-0"
            />
            <NuxtLink
              :to="localePath(item.url)"
              class="flex-1 min-w-0 flex flex-col gap-0.5"
            >
              <span class="text-sm text-default truncate hover:underline">{{ item.title }}</span>
              <span
                v-if="item.repo"
                class="text-xs text-muted truncate"
              >{{ item.repo }}{{ item.number ? ` #${item.number}` : '' }}</span>
            </NuxtLink>
            <UButton
              icon="i-lucide-bookmark-x"
              size="xs"
              color="neutral"
              variant="ghost"
              :aria-label="t('bookmark.remove')"
              class="shrink-0 cursor-pointer opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 transition-opacity"
              @click="store.removeBookmark(item.id)"
            />
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
