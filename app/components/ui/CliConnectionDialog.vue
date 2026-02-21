<script setup lang="ts">
const { t } = useI18n()
const store = useCliBridgeStore()

const open = defineModel<boolean>('open', { default: false })
const tokenInput = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

// Reset state when dialog opens, check if already connected
watch(open, (isOpen) => {
  if (isOpen) {
    error.value = null
    tokenInput.value = ''
    loading.value = false
    store.checkConnection()
  }
})

async function handleConnect() {
  if (!tokenInput.value.trim()) return
  loading.value = true
  error.value = null
  const success = await store.connect(tokenInput.value.trim())
  loading.value = false
  if (!success) {
    error.value = t('cli.invalidToken')
  }
}

async function handleDisconnect() {
  await store.disconnect()
}
</script>

<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-6 space-y-4 min-w-md">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ t('cli.title') }}
        </h2>

        <p class="text-sm text-muted">
          {{ t('cli.description') }}
        </p>

        <!-- Connected -->
        <template v-if="store.connected">
          <UAlert
            icon="i-lucide-check-circle"
            color="success"
            variant="subtle"
            :title="t('cli.connected')"
          />

          <div class="flex justify-end gap-2 pt-2">
            <UButton
              :label="t('cli.disconnect')"
              icon="i-lucide-unplug"
              variant="soft"
              color="error"
              @click="handleDisconnect"
            />
            <UButton
              :label="t('common.close')"
              variant="ghost"
              color="neutral"
              @click="open = false"
            />
          </div>
        </template>

        <!-- Not connected -->
        <template v-else>
          <UFormField :label="t('cli.tokenLabel')">
            <UInput
              v-model="tokenInput"
              :placeholder="t('cli.tokenPlaceholder')"
              class="font-mono w-full"
              size="lg"
              :disabled="loading"
              @keyup.enter="handleConnect"
            />
          </UFormField>

          <UAlert
            v-if="error"
            icon="i-lucide-circle-x"
            color="error"
            variant="subtle"
            :title="error"
          />

          <div class="flex justify-end gap-2 pt-2">
            <UButton
              :label="t('common.close')"
              variant="ghost"
              color="neutral"
              @click="open = false"
            />
            <UButton
              :label="loading ? t('cli.connecting') : t('cli.connect')"
              icon="i-lucide-plug"
              :loading="loading"
              :disabled="loading || !tokenInput.trim()"
              @click="handleConnect"
            />
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
