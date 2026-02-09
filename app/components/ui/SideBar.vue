<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()
const { loggedIn, user, clear } = useUserSession()
const colorMode = useColorMode()

const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (v) => { colorMode.preference = v ? 'dark' : 'light' },
})

// Later use a store e.g.
const notificationCount = ref(3)

const mainItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t('nav.dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: localePath('/'),
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
          >{{ t('common.title') }}</span>
        </div>
        <UDashboardSidebarCollapse />
      </div>
    </template>

    <!-- Create a global, mighty search engine. Should find anything, anywhere, instantly. -->
    <template #default="{ collapsed }">
      <UButton
        :label="collapsed ? undefined : t('nav.search')"
        :aria-label="t('nav.search')"
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
      >
        <template #notifications-leading="{ item }: { item: NavigationMenuItem }">
          <UChip
            :show="notificationCount > 0 && collapsed"
            color="error"
            size="3xs"
            inset
          >
            <UIcon
              :name="item.icon!"
              class="size-5 shrink-0"
            />
          </UChip>
        </template>
      </UNavigationMenu>
    </template>

    <template #footer="{ collapsed }">
      <div
        class="flex items-center gap-2"
        :class="collapsed ? 'flex-col' : 'w-full justify-between'"
      >
        <UButton
          v-if="!loggedIn"
          icon="i-lucide-github"
          :label="collapsed ? undefined : t('auth.login')"
          color="neutral"
          variant="ghost"
          :square="collapsed"
          class="shrink-0"
          to="/auth/github"
          external
        />
        <UButton
          v-else
          :avatar="{ src: user?.avatarUrl, alt: user?.login }"
          :label="collapsed ? undefined : (user?.name || user?.login)"
          color="neutral"
          variant="ghost"
          :square="collapsed"
          class="shrink-0"
          @click="clear"
        />

        <ClientOnly>
          <UButton
            :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
            :aria-label="isDark ? t('theme.light') : t('theme.dark')"
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
