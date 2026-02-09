<script setup lang="ts">
definePageMeta({
  titleKey: 'nav.settings',
  middleware: 'auth',
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <SettingsAppearanceSection />
  </div>
</template>
