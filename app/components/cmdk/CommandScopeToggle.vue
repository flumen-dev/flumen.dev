<script setup lang="ts">
const cmdk = useCmdkStore()
</script>

<template>
  <button
    type="button"
    :aria-label="$t('cmdk.scopeAriaToggle')"
    :aria-pressed="cmdk.scope === 'global'"
    class="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-colors"
    :class="cmdk.scope === 'global'
      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary border-primary'
      : 'bg-elevated text-muted hover:text-default border-default'"
    @click="cmdk.toggleScope()"
  >
    <UIcon
      :name="cmdk.scope === 'global' ? 'i-lucide-globe' : 'i-lucide-folder-git-2'"
      class="size-3.5"
    />
    {{ cmdk.scope === 'global' ? $t('cmdk.scopeGlobal') : $t('cmdk.scopeMine') }}
  </button>
</template>
