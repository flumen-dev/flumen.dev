<script setup lang="ts">
import type { PRHealthItem } from '~~/shared/types/pr-health'
import { buildWorkItemPath } from '~/utils/workItemPath'

const props = defineProps<{
  item: PRHealthItem
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { open: openProfile } = useUserProfileDialog()

const createdAgo = useTimeAgo(computed(() => props.item.createdAt))

const categoryConfig = {
  'ci-failing': {
    icon: 'i-lucide-circle-x',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  'merge-conflict': {
    icon: 'i-lucide-git-merge',
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
  'needs-reviewers': {
    icon: 'i-lucide-user-search',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  'stale-draft': {
    icon: 'i-lucide-file-clock',
    iconColor: 'text-muted',
    bgColor: 'bg-muted/10',
    borderColor: 'border-muted/20',
  },
  'approved-not-merged': {
    icon: 'i-lucide-circle-check-big',
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
} as const

const config = computed(() => categoryConfig[props.item.category])

const itemLink = computed(() => {
  const path = buildWorkItemPath(props.item.repo, props.item.number)
  return path ? localePath(path) : localePath('/dashboard')
})

const ciIcon = computed(() => getCIIcon(props.item.ciStatus))

const reasonText = computed(() => {
  if (props.item.category === 'stale-draft') {
    return t('dashboard.prHealth.reason.stale-draft', { days: props.item.ageDays })
  }
  return t(`dashboard.prHealth.reason.${props.item.category}`)
})

// Show first reviewer if available, otherwise author
const displayUser = computed(() =>
  props.item.requestedReviewers[0] ?? props.item.author,
)

function ageColor(days: number) {
  if (days >= 14) return 'error'
  if (days >= 7) return 'warning'
  return 'neutral'
}
</script>

<template>
  <NuxtLink
    :to="itemLink"
    class="group flex gap-3 p-3 rounded-lg border transition-all hover:shadow-sm"
    :class="[config.bgColor, config.borderColor]"
  >
    <!-- Left: icon + age badge -->
    <div class="flex flex-col items-center gap-1.5 shrink-0">
      <div
        class="size-9 rounded-full flex items-center justify-center"
        :class="config.bgColor"
      >
        <UIcon
          :name="config.icon"
          class="size-4.5"
          :class="config.iconColor"
        />
      </div>
      <UBadge
        :label="t('dashboard.prHealth.ageDays', { days: item.ageDays })"
        :color="ageColor(item.ageDays) as any"
        variant="subtle"
        size="xs"
      />
    </div>

    <!-- Center: reason + title + meta -->
    <div class="min-w-0 flex-1">
      <!-- Reason line -->
      <p
        class="text-xs font-semibold"
        :class="config.iconColor"
      >
        {{ reasonText }}
      </p>

      <!-- Title -->
      <p class="text-sm font-medium text-highlighted truncate mt-0.5 group-hover:underline">
        <UBadge
          v-if="item.isDraft"
          label="Draft"
          color="neutral"
          variant="subtle"
          size="xs"
          class="mr-1"
        />
        {{ item.title }}
        <span class="text-dimmed font-normal">#{{ item.number }}</span>
      </p>

      <!-- Meta row -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted">
        <span class="flex items-center gap-1">
          <UIcon
            name="i-lucide-git-pull-request"
            class="size-3"
          />
          {{ item.repo }}
        </span>
        <span class="flex items-center gap-1">
          <UIcon
            name="i-lucide-clock"
            class="size-3"
          />
          {{ createdAgo }}
        </span>
        <span class="flex items-center gap-1">
          <UIcon
            name="i-lucide-diff"
            class="size-3"
          />
          <span class="text-emerald-500">+{{ item.additions }}</span>
          <span class="text-red-500">-{{ item.deletions }}</span>
          <UBadge
            :label="getPRSizeLabel(item.additions, item.deletions)"
            :color="getPRSizeColor(item.additions, item.deletions) as any"
            variant="subtle"
            size="xs"
          />
        </span>
        <span
          v-if="ciIcon"
          class="flex items-center gap-1"
        >
          <UIcon
            :name="ciIcon.name"
            class="size-3"
            :class="[ciIcon.color, ciIcon.spin ? 'animate-spin' : '']"
          />
          CI
        </span>
        <span
          v-if="item.headRefName"
          class="flex items-center gap-1"
        >
          <UIcon
            name="i-lucide-git-branch"
            class="size-3"
          />
          <span class="truncate max-w-32">{{ item.headRefName }}</span>
        </span>
      </div>

      <!-- Labels -->
      <div
        v-if="item.labels.length > 0"
        class="flex items-center gap-1.5 mt-1.5"
      >
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

    <!-- Right: avatar -->
    <div class="w-20 flex flex-col items-center gap-1 shrink-0">
      <button
        type="button"
        class="cursor-pointer"
        @click.prevent="openProfile(displayUser.login)"
      >
        <UAvatar
          :src="displayUser.avatarUrl"
          :alt="displayUser.login"
          size="lg"
        />
      </button>
      <span class="text-[10px] text-muted truncate max-w-20 text-center">
        {{ displayUser.login }}
      </span>
    </div>
  </NuxtLink>
</template>
