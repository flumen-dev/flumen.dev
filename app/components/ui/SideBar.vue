<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { PinnedItemType } from '~~/shared/types/settings'

interface PinnedDragItem {
  id: string
  pinType: PinnedItemType
}

const { t } = useI18n()
const localePath = useLocalePath()
const { loggedIn, user, clear } = useUserSession()
const profileStore = useProfileStore()
const colorMode = useColorMode()

const displayName = computed(() => profileStore.profile?.name || user.value?.name || user.value?.login)
const displayAvatar = computed(() => profileStore.profile?.avatarUrl || user.value?.avatarUrl)

const userMenuItems = computed(() => [
  [{
    label: t('nav.profile'),
    icon: 'i-lucide-user',
    to: localePath(`/user/${user.value?.login}`),
  }],
  [{
    label: t('nav.logout'),
    icon: 'i-lucide-log-out',
    onSelect: () => clear(),
  }],
])

const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (v) => { colorMode.preference = v ? 'dark' : 'light' },
})

// Later use a store e.g.
const notificationCount = ref(3)

const { pinnedRepos, unpin, reorder } = usePinnedRepos()

const { update: updateSettings } = useUserSettings()

const issueStore = useIssueStore()

function selectPinnedRepo(repo: string) {
  issueStore.selectRepo(repo)
  updateSettings({ selectedRepo: repo })
}

// Drag & drop: map PinnedItem[] ↔ FreeformItemData[]
const pinnedDragItems = computed({
  get: () => pinnedRepos.value.map(p => ({ id: p.repo, pinType: p.type })),
  set: (items: PinnedDragItem[]) => {
    reorder(items.map(i => ({ repo: i.id, type: i.pinType })))
  },
})

// Search filter for pinned repos
const pinnedSearch = ref('')
const showPinnedSearch = computed(() => pinnedRepos.value.length > 5)
watch(showPinnedSearch, (visible) => {
  if (!visible) pinnedSearch.value = ''
})
const filteredPinnedRepos = computed(() => {
  if (!pinnedSearch.value) return pinnedDragItems.value
  const q = pinnedSearch.value.toLowerCase()
  return pinnedDragItems.value.filter(p => p.id.toLowerCase().includes(q))
})

const mainItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t('nav.dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: localePath('/'),
  },
  {
    label: t('nav.repos'),
    icon: 'i-lucide-book-marked',
    to: localePath('/repos'),
    disabled: !loggedIn.value,
  },
  {
    label: t('nav.issues'),
    icon: 'i-lucide-circle-dot',
    to: localePath('/issues'),
    disabled: !loggedIn.value,
  },
  {
    label: t('nav.pullRequests'),
    icon: 'i-lucide-git-pull-request',
    to: localePath('/pulls'),
    disabled: !loggedIn.value,
  },
  {
    label: t('nav.notifications'),
    icon: 'i-lucide-bell',
    to: localePath('/notifications'),
    badge: notificationCount.value > 0 ? String(notificationCount.value) : undefined,
    slot: 'notifications',
    disabled: !loggedIn.value,
  },
  {
    label: t('nav.settings'),
    icon: 'i-lucide-settings',
    to: localePath('/settings'),
    disabled: !loggedIn.value,
  },
])
</script>

<template>
  <UDashboardSidebar
    collapsible
    :ui="{
      root: 'transition-[width] duration-200 ease-in-out overflow-hidden',
      footer: 'border-t border-default',
    }"
  >
    <!-- Header -->
    <template #header="{ collapsed }">
      <div class="flex w-full items-center justify-between overflow-hidden">
        <div
          v-if="!collapsed"
          class="flex items-center gap-2"
        >
          <UiAccentColorPicker>
            <UiTheLogo
              height="1.25rem"
              class="shrink-0 cursor-pointer"
            />
          </UiAccentColorPicker>
          <span
            class="font-semibold text-sm whitespace-nowrap"
            aria-hidden="true"
          >{{ $t('common.title') }}</span>
        </div>
        <UDashboardSidebarCollapse />
      </div>
    </template>

    <!-- Create a global, mighty search engine. Should find anything, anywhere, instantly. -->
    <template #default="{ collapsed }">
      <UButton
        :label="collapsed ? undefined : t('nav.search')"
        :aria-label="$t('nav.search')"
        icon="i-lucide-search"
        color="neutral"
        variant="outline"
        block
        :square="collapsed"
      >
        <template
          v-if="!collapsed"
          #trailing
        >
          <div class="flex items-center gap-0.5 ms-auto">
            <UKbd
              value="meta"
              variant="subtle"
            />
            <UKbd
              value="K"
              variant="subtle"
            />
          </div>
        </template>
      </UButton>

      <UNavigationMenu
        :collapsed="collapsed"
        :items="mainItems"
        orientation="vertical"
        :ui="{ root: 'flex-1', list: 'flex flex-col flex-1 *:last:mt-auto' }"
      >
        <template #notifications-leading="{ item }: { item: NavigationMenuItem }">
          <UChip
            :show="notificationCount > 0 && collapsed"
            color="error"
            size="3xs"
            inset
          >
            <UIcon
              :name="
                item.icon!"
              class="size-5 shrink-0"
            />
          </UChip>
        </template>
      </UNavigationMenu>

      <!-- Pinned repos -->
      <ClientOnly>
        <nav
          v-if="pinnedRepos.length && !collapsed"
          :aria-label="$t('pinnedRepos.pinned')"
          class="mt-2 border-t border-default pt-2 px-1"
        >
          <p class="px-2 pb-1 text-xs font-semibold text-muted uppercase tracking-wide">
            {{ $t('pinnedRepos.pinned') }}
          </p>
          <UInput
            v-if="showPinnedSearch"
            v-model="pinnedSearch"
            :placeholder="$t('pinnedRepos.search')"
            icon="i-lucide-search"
            size="xs"
            class="mb-1 w-full"
          />
          <TheFreeform
            v-model="pinnedDragItems"
            :disabled="!!pinnedSearch"
            class="flex flex-col gap-0.5 max-h-50 overflow-y-auto"
          >
            <FreeformItem
              v-for="item in filteredPinnedRepos"
              :key="item.id"
              :item="item"
            >
              <template #default="{ dragging }">
                <div
                  class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-elevated/50 transition-colors group"
                  :class="{ 'opacity-50': dragging }"
                >
                  <UIcon
                    data-freeform-handle
                    name="i-lucide-grip-vertical"
                    class="size-3.5 shrink-0 text-muted/50 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <NuxtLink
                    :to="localePath('/issues')"
                    class="flex items-center gap-2 flex-1 min-w-0"
                    @click="selectPinnedRepo(item.id)"
                  >
                    <UIcon
                      :name="item.pinType === 'fork' ? 'i-lucide-git-fork' : 'i-lucide-book-marked'"
                      class="size-4 shrink-0 text-muted"
                    />
                    <span class="truncate">{{ item.id.split('/')[1] }}</span>
                    <UBadge
                      v-if="item.pinType === 'fork'"
                      color="info"
                      variant="subtle"
                      size="xs"
                    >
                      {{ $t('repos.badge.fork') }}
                    </UBadge>
                  </NuxtLink>
                  <UTooltip :text="$t('pinnedRepos.unpin')">
                    <UButton
                      icon="i-lucide-pin-off"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      square
                      :aria-label="$t('pinnedRepos.unpin')"
                      class="opacity-0 group-hover:opacity-100 shrink-0"
                      @click="unpin(item.id)"
                    />
                  </UTooltip>
                </div>
              </template>
            </FreeformItem>
            <FreeformPlaceholder />
          </TheFreeform>
        </nav>
      </ClientOnly>
    </template>

    <template #footer="{ collapsed }">
      <div
        class="flex items-center gap-2"
        :class="collapsed ? 'flex-col' : 'w-full justify-between'"
      >
        <UButton
          v-if="!loggedIn"
          icon="i-lucide-github"
          :label="collapsed ? undefined : $t('auth.login')"
          color="neutral"
          variant="ghost"
          :square="collapsed"
          class="shrink-0"
          to="/auth/github"
          external
        />
        <UDropdownMenu
          v-else
          :items="userMenuItems"
          :content="{ align: 'start', side: 'top' }"
        >
          <UButton
            :avatar="{ src: displayAvatar, alt: user?.login }"
            :label="collapsed ? undefined : displayName"
            color="neutral"
            variant="ghost"
            :square="collapsed"
            class="shrink-0"
          />
        </UDropdownMenu>

        <ClientOnly>
          <UButton
            :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
            :aria-label="isDark ? $t('theme.light') : $t('theme.dark')"
            color="neutral"
            variant="ghost"
            square
            @click="isDark = !isDark"
          />
        </ClientOnly>
      </div>
    </template>
  </UDashboardSidebar>
</template>

<style scoped>
:deep(.freeform-placeholder) {
  align-self: stretch !important;
  width: auto !important;
}
</style>
