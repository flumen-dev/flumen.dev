<script setup lang="ts">
const { locale } = useI18n()
const route = useRoute()

useHead({
  htmlAttrs: { lang: locale },
})
const { load: loadSettings } = useUserSettings()

await loadSettings()

const hasTeleportContent = useState('has-page-title-teleport', () => false)

const pageTitle = computed(() => {
  return route.meta.title as string | undefined
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
