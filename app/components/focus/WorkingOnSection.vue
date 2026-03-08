<script setup lang="ts">
import { buildWorkItemPath } from '~/utils/workItemPath'

const { t } = useI18n()
const store = useFocusStore()
const localePath = useLocalePath()

function itemRoute(item: { repo: string, number: number, type: 'issue' | 'pr' }) {
  const path = buildWorkItemPath(item.repo, item.number)
  if (!path) {
    return localePath('/focus')
  }

  return localePath(path)
}
</script>

<template>
  <div
    v-if="store.workingOn.loading && !store.workingOn.data.length"
    class="p-6 text-center"
  >
    <UIcon
      name="i-lucide-loader-2"
      class="size-6 text-dimmed mx-auto mb-2 animate-spin"
    />
    <p class="text-sm text-muted">
      {{ t('common.loading') }}
    </p>
  </div>

  <div
    v-else-if="store.workingOn.data.length === 0"
    class="p-6 text-center"
  >
    <UIcon
      name="i-lucide-hard-hat"
      class="size-8 text-dimmed mx-auto mb-2"
    />
    <p class="text-sm text-muted">
      {{ t('focus.workingOn.empty') }}
    </p>
  </div>

  <div v-else>
    <NuxtLink
      v-for="item in store.workingOn.data"
      :key="`${item.repo}#${item.number}`"
      :to="itemRoute(item)"
      class="flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors border-b border-default last:border-b-0"
    >
      <UIcon
        :name="item.type === 'issue' ? 'i-lucide-circle-dot' : 'i-lucide-git-pull-request'"
        class="size-4 mt-0.5 shrink-0"
        :class="item.type === 'issue' ? 'text-emerald-500' : (item.isDraft ? 'text-neutral-400' : 'text-blue-500')"
      />

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-highlighted truncate">
            {{ item.title }}
          </span>
          <span class="text-xs text-dimmed shrink-0">
            #{{ item.number }}
          </span>
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-xs text-muted">
            {{ item.repo }}
          </span>
          <UBadge
            v-if="item.isDraft"
            :label="$t('repos.badge.draft')"
            color="neutral"
            variant="subtle"
            size="xs"
          />
          <UBadge
            v-for="label in item.labels.slice(0, 3)"
            :key="label.name"
            :label="label.name"
            :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
            variant="subtle"
            size="xs"
          />
        </div>
      </div>

      <UBadge
        v-if="item.branchName"
        :label="item.branchName"
        color="neutral"
        variant="outline"
        size="xs"
        class="shrink-0 max-w-40 truncate"
      />
    </NuxtLink>
  </div>
</template>
