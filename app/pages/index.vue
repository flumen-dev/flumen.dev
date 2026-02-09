<script setup lang="ts">
const { t } = useI18n()

definePageMeta({
  titleKey: 'nav.dashboard',
})
</script>

<template>
  <div class="p-6">
    <h1>{{ t('nav.dashboard') }}</h1>
  </div>
</template>
