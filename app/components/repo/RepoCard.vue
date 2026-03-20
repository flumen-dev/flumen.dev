<script setup lang="ts">
const props = defineProps<{
  repo: Repository
  activity?: number[]
  openPrs?: number
  openIssues?: number
  notifications?: number
}>()

const activityColor = computed(() => getActivityColor(props.repo.pushedAt, props.repo.archived))
const timeAgo = useTimeAgo(computed(() => props.repo.pushedAt ?? props.repo.createdAt))

const { t } = useI18n()
const activityTooltip = computed(() => {
  if (props.repo.archived) return t('repos.activity.archived')
  if (!props.repo.pushedAt) return t('repos.activity.inactive')
  const days = (Date.now() - new Date(props.repo.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 7) return t('repos.activity.recent')
  if (days < 30) return t('repos.activity.moderate')
  return t('repos.activity.inactive')
})

const { isPinned, toggle: togglePin } = usePinnedRepos()
const localePath = useLocalePath()

const expandedSection = ref<'work-items' | 'notifications' | null>(null)

function navigateToWorkItems() {
  navigateTo(localePath(`/repos/${props.repo.owner.login}/${props.repo.name}/work-items`))
}

function toggleSection(section: 'work-items' | 'notifications') {
  expandedSection.value = expandedSection.value === section ? null : section
}
</script>

<template>
  <div
    class="px-4 py-3 hover:bg-elevated transition-colors cursor-pointer"
    @click="navigateToWorkItems"
  >
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
            :to="localePath(`/repos/${repo.owner.login}/${repo.name}`)"
            class="font-semibold text-highlighted truncate hover:underline cursor-pointer text-left"
            @click.stop
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
            v-if="openIssues || openPrs"
            :text="$t('repos.detail.workItems')"
          >
            <button
              class="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
              @click.stop="toggleSection('work-items')"
            >
              <UIcon
                name="i-lucide-layers"
                class="size-4"
              />
              {{ (openIssues ?? 0) + (openPrs ?? 0) }}
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
            <UTooltip :text="isPinned(repo.fullName) ? $t('pinnedRepos.unpin') : $t('pinnedRepos.pin')">
              <UButton
                :icon="isPinned(repo.fullName) ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                size="xs"
                color="neutral"
                variant="ghost"
                square
                :aria-label="isPinned(repo.fullName) ? $t('pinnedRepos.unpin') : $t('pinnedRepos.pin')"
                @click.stop="togglePin(repo.fullName, repo.fork ? 'fork' : 'repo')"
              />
            </UTooltip>
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
        <RepoWorkItemList
          v-if="expandedSection === 'work-items'"
          :owner="repo.owner.login"
          :repo="repo.name"
          link-mode="repo"
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
