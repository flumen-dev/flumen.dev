<script setup lang="ts">
definePageMeta({
  titleKey: 'nav.dashboard',
  middleware: 'auth',
})

const { t } = useI18n()
const store = useDashboardStore()

onMounted(() => {
  store.fetchWaitingOnMe()
  store.fetchPRHealth()
  store.fetchPulse()
})
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-center gap-3">
      <UIcon
        name="i-lucide-layout-dashboard"
        class="size-6 text-primary shrink-0"
      />
      <div>
        <h1 class="text-lg font-semibold text-highlighted">
          {{ t('nav.dashboard') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('dashboard.description') }}
        </p>
      </div>
    </div>

    <DashboardWaitingOnMePanel />
    <DashboardPRHealthPanel />
    <DashboardProductivityPanel />
  </div>
</template>
