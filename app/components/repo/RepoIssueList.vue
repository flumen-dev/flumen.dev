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

const { data: issues, status } = useLazyFetch<RepoIssue[]>(
  `/api/repository/${props.owner}/${props.repo}/issues`,
  {
    query: {
      limit: resolvedLimit,
      state: resolvedState,
    },
  },
)

const localePath = useLocalePath()

function issueTo(issue: RepoIssue) {
  const path = buildWorkItemPath(`${props.owner}/${props.repo}`, issue.number)
  return localePath(path ?? `/repos/${props.owner}/${props.repo}/issues/${issue.number}`)
}
</script>

<template>
  <div class="rounded-md border border-default bg-default overflow-hidden">
    <!-- Section header -->
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border-b border-default text-xs font-medium text-rose-500">
      <UIcon
        name="i-lucide-circle-dot"
        class="size-3.5"
      />
      {{ $t('nav.issues') }}
    </div>

    <!-- Loading -->
    <div
      v-if="status === 'pending'"
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('common.loading') }}
    </div>

    <!-- Issue rows -->
    <template v-else-if="issues?.length">
      <component
        :is="resolvedLinkMode === 'repo' ? 'NuxtLink' : 'a'"
        v-for="issue in issues"
        :key="issue.id"
        v-bind="resolvedLinkMode === 'repo'
          ? { to: issueTo(issue) }
          : { href: issue.htmlUrl, target: '_blank', rel: 'noopener noreferrer' }"
        class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-rose-500 hover:pl-2.5 transition-all border-b border-default last:border-b-0"
      >
        <RepoIssueRow :issue="issue" />
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
