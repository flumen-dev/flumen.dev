<script setup lang="ts">
import CommandPalette from '~/components/cmdk/CommandPalette.vue'

const { locale } = useI18n()
const ogLocale = computed(() => locale.value === 'de' ? 'de_DE' : 'en_US')

useSeoMeta({
  title: 'Flumen',
  ogTitle: 'Flumen',
  description: 'Open-source GitHub dashboard for maintainers. Open source, streamlined.',
  ogDescription: 'Open-source GitHub dashboard for maintainers. Open source, streamlined.',
  ogImage: 'https://flumen.dev/og-image.png',
  ogUrl: 'https://flumen.dev',
  ogType: 'website',
  ogLocale,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Flumen',
  twitterDescription: 'Open-source GitHub dashboard for maintainers. Open source, streamlined.',
  twitterImage: 'https://flumen.dev/og-image.png',
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <UserProfileDialog />
    <CommandPalette />
  </UApp>
</template>
