<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

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
        <UDashboardNavbar :title="pageTitle" />
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
