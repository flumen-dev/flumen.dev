<script setup lang="ts">
import type { Issue } from '~~/shared/types/issue'
import { buildWorkItemPath } from '~/utils/workItemPath'

const props = defineProps<{
  issue: Issue
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { open: openProfile } = useUserProfileDialog()
const createdAgo = useTimeAgo(computed(() => props.issue.createdAt))
const updatedAgo = useTimeAgo(computed(() => props.issue.updatedAt))

const stateIcon = computed(() => getIssueStateIcon(props.issue.state, props.issue.stateReason))
const stateColor = computed(() => getIssueStateColor(props.issue.state, props.issue.stateReason))

const router = useRouter()
const { user } = useUserSession()
const issueStore = useIssueStore()
const { localLabels, onLabelAdded, onLabelRemoved } = useLocalLabels(() => props.issue.labels)

const repo = computed(() => props.issue.repository.nameWithOwner)

function onAssigned(login: string) {
  const assignees = [...props.issue.assignees]
  if (!assignees.some(a => a.login === login)) {
    assignees.push({ login, avatarUrl: user.value?.avatarUrl ?? '' })
  }
  issueStore.updateIssue(repo.value, props.issue.number, { assignees })
}

function onUnassigned(login: string) {
  issueStore.updateIssue(repo.value, props.issue.number, {
    assignees: props.issue.assignees.filter(a => a.login !== login),
  })
}

function navigate() {
  router.push(localePath(buildWorkItemPath(repo.value, props.issue.number)!))
}
</script>

<template>
  <div
    role="link"
    tabindex="0"
    class="flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors cursor-pointer"
    @click="navigate"
    @keydown.enter="navigate"
    @keydown.space.prevent="navigate"
  >
    <!-- State icon -->
    <UIcon
      :name="stateIcon"
      class="size-5 mt-0.5 shrink-0"
      :class="stateColor"
    />

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <!-- Row 1: Title + labels -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-medium text-highlighted hover:underline">
          {{ issue.title }}
        </span>
        <UiLabelManager
          :repo="issue.repository.nameWithOwner"
          :number="issue.number"
          :labels="localLabels"
          @added="onLabelAdded"
          @removed="onLabelRemoved"
        />
      </div>

      <!-- Row 2: Meta -->
      <div class="flex items-center gap-3 mt-1 text-xs text-muted">
        <UTooltip
          v-if="!issue.maintainerCommented && issue.commentCount > 0"
          :text="t('issues.needsResponse')"
        >
          <span class="inline-flex items-center gap-0.5 text-amber-500">
            <UIcon
              name="i-lucide-message-circle-warning"
              class="size-3.5"
            />
          </span>
        </UTooltip>
        <button
          type="button"
          class="inline-flex items-center gap-1 cursor-pointer hover:underline"
          @click.stop="openProfile(issue.author.login)"
        >
          <UAvatar
            :src="issue.author.avatarUrl"
            :alt="issue.author.login"
            size="3xs"
          />
          {{ issue.author.login }}
        </button>
        <span>#{{ issue.number }}</span>
        <span>{{ createdAgo }}</span>
        <span>{{ updatedAgo }}</span>

        <span
          v-if="issue.commentCount"
          class="inline-flex items-center gap-0.5"
        >
          <UIcon
            name="i-lucide-message-square"
            class="size-3.5"
          />
          {{ issue.commentCount }}
        </span>

        <span
          v-if="issue.linkedPrCount"
          class="inline-flex items-center gap-0.5 text-blue-500"
        >
          <UIcon
            name="i-lucide-git-pull-request"
            class="size-3.5"
          />
          {{ issue.linkedPrCount }}
        </span>

        <span
          v-if="issue.state === 'CLOSED'"
          class="inline-flex items-center gap-0.5"
          :class="issue.stateReason === 'NOT_PLANNED' ? 'text-neutral-400' : 'text-violet-500'"
        >
          {{ issue.stateReason === 'NOT_PLANNED' ? t('issues.closedAsNotPlanned') : t('issues.closedAs') }}
        </span>

        <span
          v-if="issue.milestone"
          class="inline-flex items-center gap-0.5"
        >
          <UIcon
            name="i-lucide-milestone"
            class="size-3.5"
          />
          {{ issue.milestone }}
        </span>
      </div>
    </div>

    <!-- Right side: Assign + Assignees -->
    <div class="flex items-center gap-1 shrink-0">
      <UiAssignButton
        :repo="repo"
        :number="issue.number"
        :assignees="issue.assignees"
        @assigned="onAssigned"
        @unassigned="onUnassigned"
      />
      <UTooltip
        v-for="assignee in issue.assignees"
        :key="assignee.login"
        :text="assignee.login"
      >
        <button
          type="button"
          class="cursor-pointer"
          @click.stop="openProfile(assignee.login)"
        >
          <UAvatar
            :src="assignee.avatarUrl"
            :alt="assignee.login"
            size="xs"
          />
        </button>
      </UTooltip>
    </div>
  </div>
</template>
