<script setup lang="ts">
import type { PullRequest } from '~~/shared/types/pull-request'

const props = defineProps<{
  pr: PullRequest
}>()

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
