<script setup lang="ts">
const { t, locale } = useI18n()
const route = useRoute()

useHead({
  htmlAttrs: { lang: locale },
})
const { load: loadSettings } = useUserSettings()

await loadSettings()

const pageTitle = computed(() => {
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
          <UDashboardNavbar :title="pageTitle" />
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
