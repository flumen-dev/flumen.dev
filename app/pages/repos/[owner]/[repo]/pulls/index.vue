<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.pullRequests',
})

const route = useRoute()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)
const state = ref<'open' | 'closed' | 'all'>('open')

const repoFullName = computed(() => `${owner.value}/${repo.value}`)
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-center gap-2">
      <NuxtLinkLocale
        :to="`/repos/${owner}/${repo}`"
        class="text-sm font-semibold text-highlighted hover:text-primary transition-colors"
      >
        {{ repoFullName }}
      </NuxtLinkLocale>
      <span class="text-sm text-muted">/</span>
      <span class="text-sm text-muted">{{ $t('nav.pullRequests') }}</span>
    </div>

    <div class="flex items-center gap-2">
      <UButton
        size="xs"
        :variant="state === 'open' ? 'solid' : 'outline'"
        @click="state = 'open'"
      >
        {{ $t('issues.open') }}
      </UButton>
      <UButton
        size="xs"
        :variant="state === 'closed' ? 'solid' : 'outline'"
        @click="state = 'closed'"
      >
        {{ $t('issues.closed') }}
      </UButton>
      <UButton
        size="xs"
        :variant="state === 'all' ? 'solid' : 'outline'"
        @click="state = 'all'"
      >
        All
      </UButton>
    </div>

    <RepoPrList
      :owner="owner"
      :repo="repo"
      :state="state"
      :limit="50"
      link-mode="repo"
    />
  </div>
</template>
