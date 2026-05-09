<script setup lang="ts">
const props = defineProps<{
  title: string
  repo: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const issueStore = useIssueStore()
const { user } = useUserSession()

const MIN_TITLE_LEN = 8
const SCORE_THRESHOLD = 50
const MAX_RESULTS = 3

// Debounce so rankIssues doesn't run on every keystroke.
const debouncedTitle = refDebounced(computed(() => props.title), 350)

const similarIssues = computed(() => {
  const title = debouncedTitle.value.trim()
  if (title.length < MIN_TITLE_LEN) return []
  // Only operate when issues for this repo are already loaded — no hidden fetch.
  if (issueStore.selectedRepo !== props.repo || !issueStore.loaded) return []
  const pool = issueStore.issues.filter(i => i.state === 'OPEN')
  return rankIssuesScored(pool, title, user.value?.login ?? null)
    .filter(entry => entry.score >= SCORE_THRESHOLD)
    .slice(0, MAX_RESULTS)
    .map(entry => entry.issue)
})
</script>

<template>
  <div
    v-if="similarIssues.length"
    class="rounded-lg border border-info/30 bg-info/5 px-3 py-2.5"
  >
    <div class="flex items-center gap-2 mb-1.5">
      <UIcon
        name="i-lucide-lightbulb"
        class="size-4 text-info shrink-0"
      />
      <p class="text-sm font-medium text-default">
        {{ t('issues.create.similarHeading') }}
      </p>
    </div>
    <ul class="space-y-1">
      <li
        v-for="issue in similarIssues"
        :key="issue.id"
      >
        <ULink
          :to="localePath(buildWorkItemPath(repo, issue.number) ?? '/')"
          target="_blank"
          class="flex items-center gap-2 text-sm hover:underline min-w-0"
        >
          <UIcon
            :name="getIssueStateIcon(issue.state, issue.stateReason)"
            :class="getIssueStateColor(issue.state, issue.stateReason)"
            class="size-4 shrink-0"
          />
          <span class="text-muted shrink-0">#{{ issue.number }}</span>
          <span class="truncate">{{ issue.title }}</span>
        </ULink>
      </li>
    </ul>
    <p class="text-xs text-muted mt-2">
      {{ t('issues.create.similarHint') }}
    </p>
  </div>
</template>
