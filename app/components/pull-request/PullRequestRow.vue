<script setup lang="ts">
import type { PullRequest } from '~~/shared/types/pull-request'

const props = defineProps<{
  pr: PullRequest
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { open: openProfile } = useUserProfileDialog()
const createdAgo = useTimeAgo(computed(() => props.pr.createdAt))
const updatedAgo = useTimeAgo(computed(() => props.pr.updatedAt))

const repo = computed(() => props.pr.repository.nameWithOwner)

const stateIcon = computed(() => {
  if (props.pr.state === 'MERGED') return 'i-lucide-git-merge'
  if (props.pr.state === 'CLOSED') return 'i-lucide-git-pull-request-closed'
  if (props.pr.isDraft) return 'i-lucide-git-pull-request-draft'
  return 'i-lucide-git-pull-request'
})

const stateColor = computed(() => {
  if (props.pr.state === 'MERGED') return 'text-violet-500'
  if (props.pr.state === 'CLOSED') return 'text-rose-500'
  if (props.pr.isDraft) return 'text-neutral-400'
  return 'text-emerald-500'
})

const ci = computed(() => {
  switch (props.pr.ciStatus) {
    case 'SUCCESS': return { icon: 'i-lucide-check-circle-2', color: 'text-emerald-500', tooltip: t('pulls.ci.success') }
    case 'FAILURE':
    case 'ERROR': return { icon: 'i-lucide-x-circle', color: 'text-rose-500', tooltip: t('pulls.ci.failure') }
    case 'PENDING': return { icon: 'i-lucide-clock', color: 'text-amber-500', tooltip: t('pulls.ci.pending') }
    case 'EXPECTED': return { icon: 'i-lucide-clock', color: 'text-neutral-400', tooltip: t('pulls.ci.expected') }
    default: return null
  }
})

const approvedCount = computed(() =>
  props.pr.latestReviews.filter(r => r.state === 'APPROVED').length,
)
const changesRequestedCount = computed(() =>
  props.pr.latestReviews.filter(r => r.state === 'CHANGES_REQUESTED').length,
)

const approvedTooltip = computed(() => {
  const logins = props.pr.latestReviews
    .filter(r => r.state === 'APPROVED')
    .map(r => r.author.login)
    .join(', ')
  return t('pulls.review.approvedBy', { logins })
})

const changesTooltip = computed(() => {
  const logins = props.pr.latestReviews
    .filter(r => r.state === 'CHANGES_REQUESTED')
    .map(r => r.author.login)
    .join(', ')
  return t('pulls.review.changesRequestedBy', { logins })
})

const router = useRouter()

function navigate() {
  router.push(localePath(buildWorkItemPath(repo.value, props.pr.number)!))
}
</script>

<template>
  <div
    role="link"
    tabindex="0"
    class="group flex items-start gap-2 sm:gap-3 px-2 py-2.5 sm:px-4 sm:py-3 hover:bg-elevated transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-elevated"
    @click="navigate"
    @keydown.enter.self="navigate"
    @keydown.space.self.prevent="navigate"
  >
    <UIcon
      :name="stateIcon"
      class="size-5 mt-0.5 shrink-0"
      :class="stateColor"
    />

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-medium text-highlighted hover:underline text-sm sm:text-base">
          {{ pr.title }}
        </span>
        <UBadge
          v-for="label in pr.labels"
          :key="label.name"
          color="neutral"
          variant="subtle"
          size="xs"
          :style="{
            backgroundColor: `#${label.color}1a`,
            color: `#${label.color}`,
          }"
        >
          {{ label.name }}
        </UBadge>
      </div>

      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3 mt-1 text-xs text-muted">
        <button
          type="button"
          class="inline-flex items-center gap-1 cursor-pointer hover:underline"
          @click.stop="openProfile(pr.author.login)"
        >
          <UAvatar
            :src="pr.author.avatarUrl"
            :alt="pr.author.login"
            size="xs"
          />
          {{ pr.author.login }}
        </button>
        <span>#{{ pr.number }}</span>
        <span>{{ createdAgo }}</span>
        <span class="text-default">{{ updatedAgo }}</span>

        <UTooltip
          v-if="ci"
          :text="ci.tooltip"
        >
          <UIcon
            :name="ci.icon"
            class="size-3.5"
            :class="ci.color"
          />
        </UTooltip>

        <UTooltip
          v-if="approvedCount"
          :text="approvedTooltip"
        >
          <span class="inline-flex items-center gap-0.5 text-emerald-500">
            <UIcon
              name="i-lucide-check"
              class="size-3.5"
            />
            {{ approvedCount }}
          </span>
        </UTooltip>

        <UTooltip
          v-if="changesRequestedCount"
          :text="changesTooltip"
        >
          <span class="inline-flex items-center gap-0.5 text-rose-500">
            <UIcon
              name="i-lucide-x"
              class="size-3.5"
            />
            {{ changesRequestedCount }}
          </span>
        </UTooltip>

        <UTooltip
          v-if="pr.mergeable === 'CONFLICTING'"
          :text="t('pulls.merge.conflicting')"
        >
          <UIcon
            name="i-lucide-alert-triangle"
            class="size-3.5 text-rose-500"
          />
        </UTooltip>

        <span class="font-mono text-[10px] tabular-nums">
          <span class="text-emerald-500">+{{ pr.additions }}</span>
          <span class="text-rose-500 ml-1">−{{ pr.deletions }}</span>
        </span>

        <UTooltip
          v-if="pr.linkedIssueCount"
          :text="t('pulls.linkedIssues', { count: pr.linkedIssueCount })"
        >
          <span class="inline-flex items-center gap-0.5">
            <UIcon
              name="i-lucide-link-2"
              class="size-3.5"
            />
            {{ pr.linkedIssueCount }}
          </span>
        </UTooltip>

        <span
          v-if="pr.commentCount"
          class="inline-flex items-center gap-0.5"
        >
          <UIcon
            name="i-lucide-message-square"
            class="size-3.5"
          />
          {{ pr.commentCount }}
        </span>

        <span class="font-mono text-[10px] text-muted/70 truncate max-w-35">
          {{ pr.headRefName }} → {{ pr.baseRefName }}
        </span>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <UTooltip
        v-for="reviewer in pr.requestedReviewers"
        :key="reviewer.login"
        :text="reviewer.login"
      >
        <button
          type="button"
          class="cursor-pointer"
          @click.stop="openProfile(reviewer.login)"
        >
          <UAvatar
            :src="reviewer.avatarUrl"
            :alt="reviewer.login"
            size="xs"
          />
        </button>
      </UTooltip>
    </div>
  </div>
</template>
