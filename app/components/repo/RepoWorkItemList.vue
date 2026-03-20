<script setup lang="ts">
import type { WorkItem } from '~~/shared/types/work-item'

const props = defineProps<{
  owner: string
  repo: string
  limit?: number
  state?: 'open' | 'closed' | 'all'
  linkMode?: 'external' | 'repo'
}>()

const resolvedLimit = computed(() => props.limit ?? 5)
const resolvedState = computed(() => props.state ?? 'open')
const resolvedLinkMode = computed(() => props.linkMode ?? 'external')

const { data: workItems, status, error: fetchError } = useLazyFetch<WorkItem[]>(
  `/api/repository/${props.owner}/${props.repo}/work-items`,
  {
    query: {
      limit: resolvedLimit,
      state: resolvedState,
    },
  },
)

const router = useRouter()
const localePath = useLocalePath()

function navigateToItem(item: WorkItem) {
  if (resolvedLinkMode.value === 'repo') {
    router.push(localePath(`/repos/${props.owner}/${props.repo}/work-items/${item.number}`))
  }
  else {
    window.open(item.htmlUrl, '_blank', 'noopener,noreferrer')
  }
}

const { stateBadgeColor, stateBadgeLabel, prStatusLabel, ciIcon } = useWorkItemBadges()
</script>

<template>
  <div class="rounded-md border border-default bg-default overflow-hidden">
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-default text-xs font-medium text-primary">
      <UIcon
        name="i-lucide-layers"
        class="size-3.5"
      />
      {{ $t('repos.detail.workItems') }}
      <NuxtLinkLocale
        :to="`/repos/${owner}/${repo}/work-items`"
        class="ml-auto text-muted hover:text-primary transition-colors"
        @click.stop
      >
        {{ $t('common.viewAll') }}
      </NuxtLinkLocale>
    </div>

    <div
      v-if="status === 'pending'"
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('common.loading') }}
    </div>

    <template v-else-if="workItems?.length">
      <div
        v-for="item in workItems"
        :key="item.id"
        role="link"
        tabindex="0"
        class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-primary hover:pl-2.5 transition-all border-b border-default last:border-b-0 cursor-pointer"
        @click.stop="navigateToItem(item)"
        @keydown.enter.stop="navigateToItem(item)"
        @keydown.space.prevent.stop="navigateToItem(item)"
      >
        <RepoWorkItemRow
          :item="item"
          :repo="`${owner}/${repo}`"
          :state-badge-color="stateBadgeColor(item.state)"
          :state-badge-label="stateBadgeLabel(item)"
          :pr-status-label="prStatusLabel(item)"
          :ci-icon="ciIcon(item.ciStatus)"
        />
      </div>
    </template>

    <div
      v-else-if="fetchError"
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('repos.error.fetchError.title') }}
    </div>

    <div
      v-else
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('repos.noResults') }}
    </div>
  </div>
</template>
