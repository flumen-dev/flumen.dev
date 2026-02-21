<script setup lang="ts">
const { t } = useI18n()
const store = useCliBridgeStore()

const checking = ref(true)

onMounted(async () => {
  await store.checkConnection()
  checking.value = false
})

const cliDialogOpen = ref(false)

function handleClick() {
  if (store.connected) {
    store.disconnect()
  }
  else {
    cliDialogOpen.value = true
  }
}
</script>

<template>
  <div
    class="flex items-center gap-3 rounded-lg border border-default bg-elevated/50 px-3 py-2 cursor-pointer hover:bg-elevated transition-colors"
    role="button"
    @click="handleClick"
  >
    <!-- LED -->
    <span class="relative flex size-3 shrink-0">
      <span
        v-if="store.connected"
        class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75"
      />
      <span
        class="relative inline-flex size-3 rounded-full"
        :class="checking ? 'bg-amber-400 animate-pulse' : store.connected ? 'bg-emerald-500' : 'bg-neutral-400'"
      />
    </span>

    <!-- Label -->
    <span
      class="flex-1 text-sm truncate"
      :class="store.connected ? 'text-highlighted' : 'text-muted'"
    >
      <template v-if="checking">{{ t('common.loading') }}</template>
      <template v-else-if="store.connected">{{ t('cli.connected') }}</template>
      <template v-else>{{ t('cli.notConnected') }}</template>
    </span>

    <!-- Action icon -->
    <UIcon
      :name="store.connected ? 'i-lucide-unplug' : 'i-lucide-plug'"
      class="size-4 text-muted shrink-0"
    />
  </div>

  <UiCliConnectionDialog v-model:open="cliDialogOpen" />
</template>
