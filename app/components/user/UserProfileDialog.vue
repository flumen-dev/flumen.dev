<script setup lang="ts">
const { t } = useI18n()
const { isOpen, profile, loading, error, close } = useUserProfileDialog()
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :ui="{ content: 'sm:max-w-2xl' }"
    @close="close"
  >
    <template #content>
      <div class="p-6 max-h-[calc(100dvh-4rem)] overflow-y-auto">
        <!-- Loading -->
        <div
          v-if="loading"
          class="flex flex-col items-center gap-3 py-8"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="size-6 text-muted animate-spin"
          />
        </div>

        <!-- Error -->
        <div
          v-else-if="error || !profile"
          class="text-center py-8"
        >
          <UIcon
            name="i-lucide-alert-circle"
            class="size-6 text-red-500 mx-auto mb-2"
          />
          <p class="text-sm text-muted">
            {{ t('user.profile.errorLoading') }}
          </p>
        </div>

        <!-- Profile -->
        <UserProfileCard
          v-else
          :profile="profile"
        />
      </div>
    </template>
  </UModal>
</template>
