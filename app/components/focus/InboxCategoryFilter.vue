<script setup lang="ts">
const props = defineProps<{
  repos: string[]
}>()

const search = defineModel<string>('search', { default: '' })
const selectedRepos = defineModel<string[]>('selectedRepos', { default: () => [] })

const availableRepos = computed(() =>
  props.repos.map(r => ({ label: r, value: r })),
)

const { t } = useI18n()
</script>

<template>
  <div
    class="flex items-center gap-2 px-4 py-1.5 border-b border-default"
  >
    <UInput
      v-model="search"
      :placeholder="t('focus.inbox.searchPlaceholder')"
      icon="i-lucide-search"
      size="xs"
      variant="subtle"
      class="w-48"
      :ui="{ trailing: 'pe-1' }"
    >
      <template
        v-if="search"
        #trailing
      >
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          @click="search = ''"
        />
      </template>
    </UInput>

    <USelectMenu
      v-if="availableRepos.length > 1"
      v-model="selectedRepos"
      :items="availableRepos"
      value-key="value"
      multiple
      :placeholder="t('focus.inbox.allRepos')"
      size="xs"
      variant="subtle"
      class="w-48"
    />
  </div>
</template>
