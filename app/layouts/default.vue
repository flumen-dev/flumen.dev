<script setup lang="ts">
const { locale, t } = useI18n()
const route = useRoute()

useHead({
  htmlAttrs: { lang: locale },
})
const { load: loadSettings } = useUserSettings()

await loadSettings()

useRecentSync()

const hasTeleportContent = useState('has-page-title-teleport', () => false)

const pageTitle = computed(() => {
  const title = route.meta.title as string | undefined
  if (title) return title

  const key = route.meta.titleKey as string | undefined
  if (!key) {
    console.warn(`[Layout] No titleKey defined for route ${route.path}`)
  }
  return key ? t(key) : ''
})

useHead({
  title: () => pageTitle.value ? `${pageTitle.value} - Flumen` : 'Flumen',
})
</script>

<template>
  <UDashboardGroup>
    <UiSideBar />

    <UDashboardPanel>
      <template #header>
        <header role="banner">
          <UDashboardNavbar>
            <template #title>
              <div
                id="page-title-teleport"
                class="contents"
              />
              <span :class="{ hidden: hasTeleportContent }">{{ pageTitle }}</span>
            </template>
          </UDashboardNavbar>
        </header>
      </template>

      <template #body>
        <main>
          <slot />
        </main>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
