<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem, NavigationMenuItem } from '@nuxt/ui'
import type { RecentItem } from '~~/shared/types/recent'
import { shortcodeToUnicode } from '~~/shared/types/status'
import { buildWorkItemPath } from '~/utils/workItemPath'

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

const { settings, update: updateSettings } = useUserSettings()

const issueStore = useIssueStore()
const recentStore = useRecentStore()

// --- Resizable pinned section ---
const PINNED_MIN_H = 80
const PINNED_MAX_H = 600
const PINNED_DEFAULT_H = 220

function clampHeight(h: number): number {
  return Math.min(PINNED_MAX_H, Math.max(PINNED_MIN_H, h))
}

const pinnedHeight = ref(clampHeight(settings.value?.pinnedHeight ?? PINNED_DEFAULT_H))
const pinnedResizing = ref(false)
let resizeSaveTimer: ReturnType<typeof setTimeout> | null = null

// Sync pinnedHeight when settings arrive asynchronously (e.g. after SSR hydration)
watch(() => settings.value?.pinnedHeight, (h) => {
  if (h != null && !pinnedResizing.value) pinnedHeight.value = clampHeight(h)
})

onUnmounted(() => {
  if (resizeSaveTimer) clearTimeout(resizeSaveTimer)
})

function onPinnedResizeStart(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)

  pinnedResizing.value = true
  const startY = e.clientY
  const startH = pinnedHeight.value

  function onMove(ev: PointerEvent) {
    const delta = startY - ev.clientY
    pinnedHeight.value = Math.min(PINNED_MAX_H, Math.max(PINNED_MIN_H, startH + delta))
  }

  function onUp() {
    pinnedResizing.value = false
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('lostpointercapture', onUp)

    if (resizeSaveTimer) clearTimeout(resizeSaveTimer)
    resizeSaveTimer = setTimeout(() => {
      updateSettings({ pinnedHeight: pinnedHeight.value })
    }, 500)
  }

  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('lostpointercapture', onUp)
}

const sidebarSearchOpen = ref(false)
const sidebarSearchTerm = ref('')
const sidebarSearchResults = ref<SearchRepo[]>([])
const sidebarSearching = ref(false)
let sidebarSearchDebounce: ReturnType<typeof setTimeout> | null = null
let sidebarSearchRequestId = 0

function selectPinnedRepo(repo: string) {
  issueStore.selectRepo(repo)
  updateSettings({ selectedRepo: repo })
  navigateTo(localePath('/issues'))
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

function recentItemToCommand(item: RecentItem): CommandPaletteItem {
  const isIssue = item.type === 'issue'
  const workItemPath = buildWorkItemPath(item.repo, item.number, item.type)
  return {
    id: item.key,
    label: item.title,
    icon: isIssue ? 'i-lucide-circle-dot' : 'i-lucide-git-pull-request',
    suffix: `${item.repo.includes('/') ? item.repo.split('/')[1] : item.repo}#${item.number}`,
    chip: recentStore.hasUpdate(item) ? { color: 'primary' as const } : undefined,
    onSelect: () => {
      recentStore.markSeen(item.key)
      sidebarSearchOpen.value = false
      if (workItemPath) {
        navigateTo(localePath(workItemPath))
      }
      else if (isIssue) {
        navigateTo(localePath('/issues'))
      }
      else if (!isIssue) {
        navigateTo(item.url, { external: true, open: { target: '_blank' } })
      }
    },
  }
}

const sidebarSearchGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const term = sidebarSearchTerm.value.trim()

  if (!term) {
    const groups: CommandPaletteGroup<CommandPaletteItem>[] = []
    const favs = recentStore.favorites
    const recents = recentStore.items

    if (favs.length) {
      groups.push({
        id: 'favorites',
        label: t('focus.recent.searchFavorites'),
        items: favs.map(recentItemToCommand),
        ignoreFilter: true,
      })
    }

    if (recents.length) {
      groups.push({
        id: 'recent',
        label: t('focus.recent.searchRecent'),
        items: recents.slice(0, 10).map(recentItemToCommand),
        ignoreFilter: true,
      })
    }

    if (!groups.length) {
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

    return groups
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
    label: t('nav.dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: localePath('/dashboard'),
    disabled: !loggedIn.value,
  },
  {
    label: t('nav.focus'),
    icon: 'i-lucide-crosshair',
    to: localePath('/focus'),
    disabled: !loggedIn.value,
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
        <!-- Collapsed: icon-only with tooltips -->
        <nav
          v-if="pinnedRepos.length && collapsed"
          :aria-label="$t('pinnedRepos.pinned')"
          class="mt-auto border-t border-default pt-2 flex flex-col items-center gap-1 overflow-y-auto max-h-80"
        >
          <UIcon
            name="i-lucide-pin"
            class="size-3.5 text-muted/50 shrink-0 mb-0.5"
          />
          <UTooltip
            v-for="item in pinnedRepos"
            :key="item.repo"
            :text="item.repo.split('/')[1] ?? item.repo"
            :content="{ side: 'right' }"
          >
            <UButton
              :icon="item.type === 'fork' ? 'i-lucide-git-fork' : 'i-lucide-book-marked'"
              color="neutral"
              variant="ghost"
              square
              size="sm"
              :aria-label="item.repo"
              @click="selectPinnedRepo(item.repo)"
            />
          </UTooltip>
        </nav>

        <!-- Expanded: full list with drag & resize -->
        <nav
          v-if="pinnedRepos.length && !collapsed"
          :aria-label="$t('pinnedRepos.pinned')"
          class="mt-2 border-t border-default px-1"
        >
          <!-- Resize handle (on divider) -->
          <div
            class="flex justify-center py-1 cursor-row-resize group touch-none select-none"
            @pointerdown="onPinnedResizeStart"
          >
            <UIcon
              name="i-lucide-grip-horizontal"
              class="size-4 text-muted/50 group-hover:text-primary transition-colors"
            />
          </div>
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
            class="flex flex-col gap-0.5 overflow-y-auto"
            :style="{ height: `${pinnedHeight}px` }"
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
                  <button
                    class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
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
                      class="shrink-0"
                    >
                      {{ $t('repos.badge.fork') }}
                    </UBadge>
                  </button>
                  <UTooltip :text="$t('pinnedRepos.unpin')">
                    <UButton
                      icon="i-lucide-pin-off"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      square
                      :aria-label="$t('pinnedRepos.unpin')"
                      class="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
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

:deep(.freeform-item) {
  width: 100%;
}
</style>
