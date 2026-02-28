<script setup lang="ts">
import type { WaitingOnMeItem } from '~~/shared/types/waiting-on-me'
import { buildWorkItemPath } from '~/utils/workItemPath'

const props = defineProps<{
  item: WaitingOnMeItem
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { open: openProfile } = useUserProfileDialog()

const createdAgo = useTimeAgo(computed(() => props.item.createdAt))

const categoryConfig = {
  'review-requested': {
    icon: 'i-lucide-git-pull-request',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  'needs-response': {
    icon: 'i-lucide-message-circle',
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  'changes-requested': {
    icon: 'i-lucide-pencil',
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
} as const

const config = computed(() => categoryConfig[props.item.category])

const itemLink = computed(() => {
  const path = buildWorkItemPath(props.item.repo, props.item.number, props.item.type)
  return path ? localePath(path) : localePath('/dashboard')
})

const ciIcon = computed(() => getCIIcon(props.item.ciStatus))

function waitingColor(days: number) {
  if (days >= 7) return 'error'
  if (days >= 3) return 'warning'
  return 'neutral'
}
</script>

<template>
  <NuxtLink
    :to="itemLink"
    class="group flex gap-3 p-3 rounded-lg border transition-all hover:shadow-sm"
    :class="[config.bgColor, config.borderColor]"
  >
    <!-- Left: icon + waiting days -->
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
        :label="t('focus.waitingOnMe.waitingDays', { days: item.waitingDays })"
        :color="waitingColor(item.waitingDays) as any"
        variant="subtle"
        size="xs"
      />
    </div>

    <!-- Center: reason + title + meta -->
    <div class="min-w-0 flex-1">
      <!-- Reason line: WHY they're waiting -->
      <p
        class="text-xs font-semibold"
        :class="config.iconColor"
      >
        {{ t(`focus.waitingOnMe.reason.${item.category}`, { login: item.requester.login }) }}
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
            :name="item.type === 'pr' ? 'i-lucide-git-pull-request' : 'i-lucide-circle-dot'"
            class="size-3"
          />
          {{ item.repo }}
        </span>
        <span class="flex items-center gap-1">
          <UIcon
            name="i-lucide-message-square"
            class="size-3"
          />
          {{ item.commentsCount }}
        </span>
        <span class="flex items-center gap-1">
          <UIcon
            name="i-lucide-clock"
            class="size-3"
          />
          {{ createdAgo }}
        </span>
        <span
          v-if="item.additions !== null"
          class="flex items-center gap-1"
        >
          <UIcon
            name="i-lucide-diff"
            class="size-3"
          />
          <span class="text-emerald-500">+{{ item.additions }}</span>
          <span class="text-red-500">-{{ item.deletions }}</span>
          <UBadge
            :label="getPRSizeLabel(item.additions!, item.deletions!)"
            :color="getPRSizeColor(item.additions!, item.deletions!) as any"
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

    <!-- Right: requester avatar -->
    <div class="w-20 flex flex-col items-center gap-1 shrink-0">
      <button
        type="button"
        class="cursor-pointer"
        @click.prevent="openProfile(item.requester.login)"
      >
        <UAvatar
          :src="item.requester.avatarUrl"
          :alt="item.requester.login"
          size="lg"
        />
      </button>
      <span class="text-[10px] text-muted truncate max-w-20 text-center">
        {{ item.requester.login }}
      </span>
    </div>
  </NuxtLink>
</template>
