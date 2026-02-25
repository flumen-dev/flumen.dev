<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem, NavigationMenuItem } from '@nuxt/ui'
import { shortcodeToUnicode } from '~~/shared/types/status'

interface PinnedDragItem {
  id: string
  pinType: PinnedItemType
}

interface SearchRepo {
  id: number
  fullName: string
  name: string
  owner: string
  ownerAvatarUrl?: string
  description: string | null
  language: string | null
  visibility: string
  openIssues: number
  stars: number
  fork: boolean
}

const { t } = useI18n()
const localePath = useLocalePath()
const { loggedIn, user, clear } = useUserSession()
const profileStore = useProfileStore()
if (loggedIn.value) profileStore.fetchStatus()
const colorMode = useColorMode()
const apiFetch = useRequestFetch()

const displayName = computed(() => profileStore.profile?.name || user.value?.name || user.value?.login)
const displayAvatar = computed(() => profileStore.profile?.avatarUrl || user.value?.avatarUrl)

const statusDialogOpen = ref(false)

const statusLabel = computed(() => {
  const s = profileStore.status
  if (s?.emoji || s?.message) {
    return `${shortcodeToUnicode(s.emoji) ?? ''} ${s.message ?? ''}`.trim()
  }
  return t('status.setStatus')
})

const userMenuItems = computed(() => [
  [{
    label: statusLabel.value,
    icon: 'i-lucide-smile',
    onSelect: () => { statusDialogOpen.value = true },
  }],
  [{
    label: t('nav.profile'),
    icon: 'i-lucide-user',
    to: localePath(`/user/${user.value?.login}`),
  }],
  [{
    label: t('nav.logout'),
    icon: 'i-lucide-log-out',
    onSelect: async () => {
      await clear()
      await navigateTo(localePath('/'), { external: true })
    },
  }],
])

const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (v) => { colorMode.preference = v ? 'dark' : 'light' },
})

const { pinnedRepos, unpin, reorder } = usePinnedRepos()

const { update: updateSettings } = useUserSettings()

const issueStore = useIssueStore()

const sidebarSearchOpen = ref(false)
const sidebarSearchTerm = ref('')
const sidebarSearchResults = ref<SearchRepo[]>([])
const sidebarSearching = ref(false)
let sidebarSearchDebounce: ReturnType<typeof setTimeout> | null = null
let sidebarSearchRequestId = 0

function selectPinnedRepo(repo: string) {
  issueStore.selectRepo(repo)
  updateSettings({ selectedRepo: repo })
}

function resetSidebarSearch() {
  if (sidebarSearchDebounce) clearTimeout(sidebarSearchDebounce)
  sidebarSearchTerm.value = ''
  sidebarSearchResults.value = []
  sidebarSearching.value = false
}

watch(sidebarSearchOpen, (isOpen) => {
  if (!isOpen) resetSidebarSearch()
})

watch(sidebarSearchTerm, (q) => {
  if (sidebarSearchDebounce) clearTimeout(sidebarSearchDebounce)
  const trimmed = q?.trim()

  if (!trimmed || trimmed.length < 2) {
    sidebarSearchResults.value = []
    sidebarSearching.value = false
    return
  }

  sidebarSearching.value = true
  const requestId = ++sidebarSearchRequestId

  sidebarSearchDebounce = setTimeout(async () => {
    try {
      const results = await apiFetch<SearchRepo[]>('/api/repository/search', {
        params: { q: trimmed },
      })

      if (requestId !== sidebarSearchRequestId) return
      sidebarSearchResults.value = results
    }
    catch {
      if (requestId !== sidebarSearchRequestId) return
      sidebarSearchResults.value = []
    }
    finally {
      if (requestId === sidebarSearchRequestId) {
        sidebarSearching.value = false
      }
    }
  }, 250)
})

function openSidebarSearch() {
  if (!loggedIn.value) return
  sidebarSearchOpen.value = true
}

function selectSearchRepo(repo: SearchRepo) {
  sidebarSearchOpen.value = false
  navigateTo(localePath(`/repos/${repo.owner}/${repo.name}`))
}

const sidebarSearchGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const term = sidebarSearchTerm.value.trim()

  if (!term) {
    return [{
      id: 'hint',
      items: [{
        label: t('repos.searchStartTyping'),
        icon: 'i-lucide-search',
        disabled: true,
      }],
      ignoreFilter: true,
    }]
  }

  if (term.length < 2) {
    return [{
      id: 'minimum',
      items: [{
        label: t('repos.searchMinChars'),
        icon: 'i-lucide-text-cursor-input',
        disabled: true,
      }],
      ignoreFilter: true,
    }]
  }

  if (sidebarSearching.value && !sidebarSearchResults.value.length) {
    return [{
      id: 'loading',
      items: [{
        label: t('common.loading'),
        icon: 'i-lucide-loader-circle',
        disabled: true,
      }],
      ignoreFilter: true,
    }]
  }

  if (!sidebarSearchResults.value.length) {
    return [{
      id: 'empty',
      items: [{
        label: t('repos.searchNoMatches'),
        icon: 'i-lucide-circle-off',
        disabled: true,
      }],
      ignoreFilter: true,
    }]
  }

  return [{
    id: 'repositories',
    label: t('nav.repos'),
    items: sidebarSearchResults.value.map(repo => ({
      id: `repo-${repo.id}`,
      label: repo.fullName,
      icon: repo.fork ? 'i-lucide-git-fork' : 'i-lucide-book-marked',
      disabled: false,
      suffix: repo.visibility,
      avatar: repo.ownerAvatarUrl
        ? {
            src: repo.ownerAvatarUrl,
            alt: repo.owner,
          }
        : undefined,
      onSelect: () => selectSearchRepo(repo),
    })),
    ignoreFilter: true,
  }]
})

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
    label: t('nav.focus'),
    icon: 'i-lucide-crosshair',
    to: localePath('/focus'),
    disabled: !loggedIn.value,
  },
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
        :disabled="!loggedIn"
        @click="openSidebarSearch"
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
      />

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
                    class="size-3.5 shrink-0 text-muted/50 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
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

      <!-- CLI Status -->
      <ClientOnly>
        <div
          v-if="loggedIn && !collapsed"
          class="border-t border-default pt-2 px-1"
        >
          <UiCliStatus />
        </div>
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
            color="neutral"
            variant="ghost"
            :square="collapsed"
            class="flex-1 min-w-0 items-start"
          >
            <UAvatar
              :src="displayAvatar"
              :alt="user?.login"
              size="2xs"
            />
            <div
              v-if="!collapsed"
              class="flex flex-col items-start min-w-0"
            >
              <span class="text-sm font-medium truncate">{{ displayName }}</span>
              <UiStatusBadge compact />
            </div>
          </UButton>
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
  <ClientOnly>
    <UDashboardSearch
      v-model:open="sidebarSearchOpen"
      v-model:search-term="sidebarSearchTerm"
      shortcut="meta_k"
      :groups="sidebarSearchGroups"
      :placeholder="$t('repos.search')"
      :title="$t('repos.search')"
      :close="{ color: 'neutral', variant: 'ghost' }"
    />
  </ClientOnly>
  <UiStatusDialog v-model:open="statusDialogOpen" />
</template>

<style scoped>
:deep(.freeform-placeholder) {
  align-self: stretch !important;
  width: auto !important;
}
</style>
