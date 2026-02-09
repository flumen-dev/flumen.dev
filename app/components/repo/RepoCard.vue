<script setup lang="ts">
const props = defineProps<{
  repo: Repository
  activity?: number[]
  openPrs?: number
  openIssues?: number
  notifications?: number
}>()

const activityColor = computed(() => getActivityColor(props.repo.pushedAt, props.repo.archived))
const timeAgo = useTimeAgo(computed(() => props.repo.pushedAt))

const { t } = useI18n()
const activityTooltip = computed(() => {
  if (props.repo.archived) return t('repos.activity.archived')
  const days = (Date.now() - new Date(props.repo.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 7) return t('repos.activity.recent')
  if (days < 30) return t('repos.activity.moderate')
  return t('repos.activity.inactive')
})

const expandedSection = ref<'issues' | 'prs' | 'notifications' | null>(null)

function toggleSection(section: 'issues' | 'prs' | 'notifications') {
  expandedSection.value = expandedSection.value === section ? null : section
}
</script>

<template>
  <div class="px-4 py-3 hover:bg-elevated transition-colors">
    <div class="flex items-start gap-3">
      <!-- Activity dot -->
      <UTooltip
        :text="activityTooltip"
        class="mt-1.5 shrink-0"
      >
        <span
          class="block size-2.5 rounded-full"
          :class="activityColor"
          style="background-color: currentColor;"
        />
      </UTooltip>

      <!-- Content -->
      <div class="min-w-0 flex-1">
        <!-- Row 1: Name + badges + time -->
        <div class="flex items-center gap-2">
          <NuxtLink
            :to="repo.htmlUrl"
            external
            target="_blank"
            class="font-semibold text-highlighted truncate hover:underline"
          >
            {{ repo.name }}
          </NuxtLink>

          <UBadge
            v-if="repo.archived"
            color="warning"
            variant="subtle"
            size="xs"
          >
            {{ $t('repos.badge.archived') }}
          </UBadge>
          <UBadge
            v-if="repo.fork"
            color="info"
            variant="subtle"
            size="xs"
          >
            {{ $t('repos.badge.fork') }}
          </UBadge>
          <UBadge
            v-if="repo.visibility === 'private'"
            color="neutral"
            variant="subtle"
            size="xs"
          >
            {{ $t('repos.badge.private') }}
          </UBadge>

          <!-- Issues / PRs / Notifications — icon + count, no border -->
          <UTooltip
            v-if="openIssues"
            :text="$t('repos.openIssues', { count: openIssues })"
          >
            <button
              class="inline-flex items-center gap-0.5 text-xs font-medium text-rose-500 hover:text-rose-400 transition-colors cursor-pointer"
              @click.stop="toggleSection('issues')"
            >
              <UIcon
                name="i-lucide-circle-dot"
                class="size-4"
              />
              {{ openIssues }}
            </button>
          </UTooltip>

          <UTooltip
            v-if="openPrs"
            :text="$t('repos.openPrs', { count: openPrs })"
          >
            <button
              class="inline-flex items-center gap-0.5 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
              @click.stop="toggleSection('prs')"
            >
              <UIcon
                name="i-lucide-git-pull-request"
                class="size-4"
              />
              {{ openPrs }}
            </button>
          </UTooltip>

          <UTooltip
            v-if="notifications"
            :text="$t('repos.unreadNotifications', { count: notifications })"
          >
            <button
              class="inline-flex items-center gap-0.5 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              @click.stop="toggleSection('notifications')"
            >
              <UIcon
                name="i-lucide-bell"
                class="size-4.5 animate-bell"
              />
              {{ notifications }}
            </button>
          </UTooltip>

          <div class="ml-auto flex items-center gap-2 shrink-0">
            <RepoSparkline
              v-if="activity"
              :weeks="activity"
            />
            <span class="text-xs text-dimmed">
              {{ timeAgo }}
            </span>
          </div>
        </div>

        <!-- Row 2: Description (always rendered for consistent height) -->
        <p class="text-sm text-muted truncate mt-0.5 min-h-5">
          {{ repo.description }}
        </p>

        <!-- Row 3: Stats -->
        <div class="mt-1.5">
          <RepoStats :repo="repo" />
        </div>
      </div>
    </div>
    <!-- Expandable section (single container, content swaps) -->
    <UCollapsible :open="expandedSection !== null">
      <template #content>
        <RepoIssueList
          v-if="expandedSection === 'issues'"
          :owner="repo.owner.login"
          :repo="repo.name"
          class="mt-2"
        />
        <RepoPrList
          v-if="expandedSection === 'prs'"
          :owner="repo.owner.login"
          :repo="repo.name"
          class="mt-2"
        />
        <RepoNotificationList
          v-if="expandedSection === 'notifications'"
          :owner="repo.owner.login"
          :repo="repo.name"
          class="mt-2"
        />
      </template>
    </UCollapsible>
  </div>
</template>
