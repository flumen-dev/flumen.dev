<script setup lang="ts">
import { buildWorkItemPath } from '~/utils/workItemPath'

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

const { data: pulls, status } = useLazyFetch<RepoPullRequest[]>(
  `/api/repository/${props.owner}/${props.repo}/pulls`,
  {
    query: {
      limit: resolvedLimit,
      state: resolvedState,
    },
  },
)

const localePath = useLocalePath()

function pullTo(pr: RepoPullRequest) {
  return localePath(buildWorkItemPath(`${props.owner}/${props.repo}`, pr.number)!)
}
</script>

<template>
  <div class="rounded-md border border-default bg-default overflow-hidden">
    <!-- Section header -->
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border-b border-default text-xs font-medium text-blue-500">
      <UIcon
        name="i-lucide-git-pull-request"
        class="size-3.5"
      />
      {{ $t('nav.pullRequests') }}
    </div>

    <!-- Loading -->
    <div
      v-if="status === 'pending'"
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('common.loading') }}
    </div>

    <!-- PR rows -->
    <template v-else-if="pulls?.length">
      <component
        :is="resolvedLinkMode === 'repo' ? 'NuxtLink' : 'a'"
        v-for="pr in pulls"
        :key="pr.id"
        v-bind="resolvedLinkMode === 'repo'
          ? { to: pullTo(pr) }
          : { href: pr.htmlUrl, target: '_blank', rel: 'noopener noreferrer' }"
        class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-blue-500 hover:pl-2.5 transition-all border-b border-default last:border-b-0"
      >
        <RepoPrRow :pr="pr" />
      </component>
    </template>

    <!-- Empty -->
    <div
      v-else
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('repos.noResults') }}
    </div>
  </div>
</template>
