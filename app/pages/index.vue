<script setup lang="ts">
const { loggedIn } = useUserSession()

definePageMeta({
  layout: false,
  titleKey: 'nav.dashboard',
})
</script>

<template>
  <UiWelcomeScreen v-if="!loggedIn" />

  <NuxtLayout
    v-else
    name="default"
  >
    <div class="p-6">
      <h1>{{ $t('nav.dashboard') }}</h1>
    </div>
  </NuxtLayout>
</template>
