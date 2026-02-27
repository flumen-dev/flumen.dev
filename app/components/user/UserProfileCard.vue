<script setup lang="ts">
import type { ProfilePin } from '~~/shared/types/profile'
import { shortcodeToUnicode } from '~~/shared/types/status'
import type { SharedRepo } from '~~/server/api/user/shared-repos.get'
import type { ActivityType, UserActivityEvent } from '~~/server/utils/activity'

const props = defineProps<{
  profile: UserProfileData
}>()

const { t, d } = useI18n()

const joinDate = computed(() => d(Date.parse(props.profile.createdAt), 'short').toString())

const githubUrl = computed(() => `https://github.com/${props.profile.login}`)

const blogUrl = computed(() => {
  if (!props.profile.blog) return ''
  return props.profile.blog.startsWith('http') ? props.profile.blog : `https://${props.profile.blog}`
})

const blogDisplay = computed(() => {
  if (!props.profile.blog) return ''
  return props.profile.blog.replace(/^https?:\/\//, '').replace(/\/$/, '')
})

const links = computed(() => {
  const items: { icon: string, label: string, href: string }[] = []
  if (props.profile.blog) {
    items.push({ icon: 'i-lucide-globe', label: blogDisplay.value, href: blogUrl.value })
  }
  if (props.profile.twitterUsername) {
    items.push({ icon: 'i-lucide-twitter', label: `@${props.profile.twitterUsername}`, href: `https://x.com/${props.profile.twitterUsername}` })
  }
  return items
})

const { data: readmeData } = useFetch('/api/user/profile-readme', {
  params: { login: props.profile.login },
  lazy: true,
})

const readme = computed(() => readmeData.value?.content ?? null)
const readmeExpanded = ref(false)

const { data: sharedRepos } = useFetch<SharedRepo[]>('/api/user/shared-repos', {
  params: { login: props.profile.login },
  lazy: true,
  default: () => [],
})

const { data: pinnedReposData } = useFetch<{ pinned: ProfilePin[] }>('/api/user/pinned-repos', {
  params: { login: props.profile.login },
  lazy: true,
})

const pinnedRepos = computed(() => pinnedReposData.value?.pinned ?? [])

const { data: activity } = useFetch<UserActivityEvent[]>('/api/user/activity', {
  params: { login: props.profile.login },
  lazy: true,
  default: () => [],
})

const activityExpanded = ref(false)
const visibleActivity = computed(() =>
  activityExpanded.value ? activity.value : activity.value.slice(0, 3),
)

const activityIcons: Record<ActivityType, string> = {
  push: 'i-lucide-git-commit-horizontal',
  pr: 'i-lucide-git-pull-request',
  issue: 'i-lucide-circle-dot',
  create: 'i-lucide-plus',
  release: 'i-lucide-tag',
  star: 'i-lucide-star',
  fork: 'i-lucide-git-fork',
}

function activityLabel(ev: UserActivityEvent): string {
  switch (ev.type) {
    case 'push': return t('user.profile.activity.push', { branch: ev.ref ?? 'main' })
    case 'pr': return t('user.profile.activity.pr', { action: ev.action ?? 'opened', number: ev.number ?? 0 })
    case 'issue': return t('user.profile.activity.issue', { action: ev.action ?? 'opened', number: ev.number ?? 0 })
    case 'create': return t('user.profile.activity.create', { type: ev.refType ?? 'branch', ref: ev.ref ?? '' })
    case 'release': return t('user.profile.activity.release', { tag: ev.tagName ?? '' })
    case 'star': return t('user.profile.activity.starred')
    case 'fork': return t('user.profile.activity.forked')
    default:
      return ev.type satisfies never
  }
}
</script>

<template>
  <div class="space-y-4 sm:space-y-5">
    <!-- Header -->
    <div class="flex items-start gap-3 sm:gap-4">
      <UAvatar
        :src="profile.avatarUrl"
        :alt="profile.login"
        size="xl"
        class="ring-2 ring-default shrink-0"
      />
      <div class="min-w-0 flex-1">
        <h2
          v-if="profile.name"
          class="text-base sm:text-lg font-semibold text-highlighted truncate"
        >
          {{ profile.name }}
        </h2>
        <p class="text-sm text-muted truncate">
          @{{ profile.login }}
          <span
            v-if="profile.pronouns"
            class="text-dimmed"
          >
            · {{ profile.pronouns }}
          </span>
        </p>
        <div
          v-if="profile.status?.emoji || profile.status?.message"
          class="mt-1 flex items-center gap-1.5 text-sm text-muted"
        >
          <span v-if="profile.status.emoji">{{ shortcodeToUnicode(profile.status.emoji) }}</span>
          <span
            v-if="profile.status.message"
            class="truncate"
          >{{ profile.status.message }}</span>
          <UBadge
            v-if="profile.status.limitedAvailability"
            :label="t('user.profile.busy')"
            color="warning"
            variant="subtle"
            size="xs"
          />
        </div>
        <p
          v-if="profile.bio"
          class="mt-1.5 text-xs sm:text-sm text-default leading-relaxed line-clamp-3 sm:line-clamp-none"
        >
          {{ profile.bio }}
        </p>
      </div>
    </div>

    <!-- Stats row -->
    <div class="flex items-center gap-3 sm:gap-5 text-sm">
      <div class="flex items-center gap-1">
        <span class="font-semibold text-highlighted">{{ profile.followers }}</span>
        <span class="text-muted text-xs sm:text-sm">{{ t('user.profile.followers') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="font-semibold text-highlighted">{{ profile.following }}</span>
        <span class="text-muted text-xs sm:text-sm">{{ t('user.profile.following') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="font-semibold text-highlighted">{{ profile.publicRepos }}</span>
        <span class="text-muted text-xs sm:text-sm">{{ t('user.profile.repositories') }}</span>
      </div>
    </div>

    <!-- Achievements -->
    <UserAchievements
      :login="profile.login"
      compact
    />

    <!-- Details -->
    <div
      v-if="profile.company || profile.location || links.length > 0"
      class="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 text-xs sm:text-sm text-muted"
    >
      <span
        v-if="profile.company"
        class="inline-flex items-center gap-1.5"
      >
        <UIcon
          name="i-lucide-building-2"
          class="size-4 shrink-0"
        />
        {{ profile.company }}
      </span>
      <span
        v-if="profile.location"
        class="inline-flex items-center gap-1.5"
      >
        <UIcon
          name="i-lucide-map-pin"
          class="size-4 shrink-0"
        />
        {{ profile.location }}
      </span>
      <a
        v-for="link in links"
        :key="link.href"
        :href="link.href"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1.5 text-primary hover:underline transition-colors"
      >
        <UIcon
          :name="link.icon"
          class="size-4 shrink-0"
        />
        {{ link.label }}
      </a>
    </div>

    <!-- Pinned Repos -->
    <div
      v-if="pinnedRepos.length"
      class="space-y-2"
    >
      <h3 class="text-xs font-semibold text-muted uppercase tracking-wide">
        {{ t('profile.pins.title') }}
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div
          v-for="repo in pinnedRepos"
          :key="repo.id"
          class="flex flex-col p-2.5 rounded-lg border border-default"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <UIcon
              :name="repo.fork ? 'i-lucide-git-fork' : 'i-lucide-book-marked'"
              class="size-3.5 shrink-0 text-muted"
            />
            <span class="text-sm font-medium text-highlighted truncate">
              {{ repo.name }}
            </span>
          </div>
          <p class="mt-1 text-xs text-muted line-clamp-2 flex-1">
            {{ repo.description ?? '' }}
          </p>
          <div class="mt-1.5 flex items-center gap-3 text-xs text-dimmed">
            <span
              v-if="repo.language"
              class="inline-flex items-center gap-1"
            >
              <span class="size-2 rounded-full bg-primary" />
              {{ repo.language }}
            </span>
            <span class="inline-flex items-center gap-1">
              <UIcon
                name="i-lucide-star"
                class="size-3"
              />
              {{ repo.stars }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Repos -->
    <div
      v-if="profile.topRepos?.length"
      class="space-y-2"
    >
      <h3 class="text-xs font-semibold text-muted uppercase tracking-wide">
        {{ t('user.profile.topRepos') }}
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a
          v-for="repo in profile.topRepos.slice(0, 4)"
          :key="repo.fullName"
          :href="`https://github.com/${repo.fullName}`"
          target="_blank"
          rel="noopener"
          class="p-2.5 rounded-lg border border-default hover:bg-elevated transition-colors group"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <UIcon
              name="i-lucide-book-marked"
              class="size-3.5 shrink-0 text-muted"
            />
            <span class="text-sm font-medium text-highlighted truncate group-hover:text-primary transition-colors">
              {{ repo.name }}
            </span>
            <UBadge
              v-if="repo.fork"
              size="xs"
              color="neutral"
              variant="subtle"
            >
              {{ t('user.profile.fork') }}
            </UBadge>
          </div>
          <p
            v-if="repo.description"
            class="mt-1 text-xs text-muted line-clamp-2"
          >
            {{ repo.description }}
          </p>
          <div class="mt-1.5 flex items-center gap-3 text-xs text-dimmed">
            <span
              v-if="repo.language"
              class="inline-flex items-center gap-1"
            >
              <span class="size-2 rounded-full bg-primary" />
              {{ repo.language }}
            </span>
            <span class="inline-flex items-center gap-1">
              <UIcon
                name="i-lucide-star"
                class="size-3"
              />
              {{ repo.stars }}
            </span>
          </div>
        </a>
      </div>
    </div>

    <!-- Profile README -->
    <div
      v-if="readme"
      class="space-y-2"
    >
      <button
        class="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wide hover:text-highlighted transition-colors"
        @click="readmeExpanded = !readmeExpanded"
      >
        <UIcon
          :name="readmeExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="size-3.5"
        />
        README
      </button>
      <div
        v-if="readmeExpanded"
        class="rounded-lg border border-default p-3 max-h-48 overflow-y-auto text-sm"
      >
        <UiMarkdownRenderer
          :source="readme"
          :breaks="false"
        />
      </div>
    </div>

    <!-- Shared Repos -->
    <div
      v-if="sharedRepos.length > 0"
      class="space-y-2"
    >
      <h3 class="text-xs font-semibold text-muted uppercase tracking-wide">
        {{ t('user.profile.sharedRepos') }}
      </h3>
      <div class="space-y-1">
        <a
          v-for="repo in sharedRepos"
          :key="repo.fullName"
          :href="`https://github.com/${repo.fullName}`"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-elevated transition-colors group"
        >
          <UIcon
            name="i-lucide-book-marked"
            class="size-3.5 shrink-0 text-muted"
          />
          <span class="text-sm text-highlighted truncate group-hover:text-primary transition-colors">
            {{ repo.fullName }}
          </span>
          <span
            v-if="repo.language"
            class="text-xs text-dimmed shrink-0"
          >{{ repo.language }}</span>
          <span class="inline-flex items-center gap-0.5 text-xs text-dimmed shrink-0 ml-auto">
            <UIcon
              name="i-lucide-star"
              class="size-3"
            />
            {{ repo.stars }}
          </span>
        </a>
      </div>
    </div>

    <!-- Recent Activity -->
    <div
      v-if="activity.length > 0"
      class="space-y-2"
    >
      <h3 class="text-xs font-semibold text-muted uppercase tracking-wide">
        {{ t('user.profile.recentActivity') }}
      </h3>
      <div class="space-y-1">
        <div
          v-for="(ev, i) in visibleActivity"
          :key="i"
          class="flex items-center gap-2 px-2 py-1 text-xs"
        >
          <UIcon
            :name="activityIcons[ev.type]"
            class="size-3.5 shrink-0 text-muted"
          />
          <span class="text-muted truncate">{{ activityLabel(ev) }}</span>
          <span class="text-dimmed shrink-0 ml-auto truncate max-w-35">{{ ev.repo }}</span>
        </div>
        <button
          v-if="activity.length > 3"
          class="text-xs text-muted hover:text-highlighted transition-colors px-2 py-0.5"
          @click="activityExpanded = !activityExpanded"
        >
          {{ activityExpanded ? t('issues.sidebar.showLess') : `+${activity.length - 3}` }}
        </button>
      </div>
    </div>

    <!-- Contribution Graph -->
    <UserContributionGraph :login="profile.login" />

    <!-- Footer -->
    <div class="flex items-center justify-between pt-1 border-t border-default">
      <span class="text-xs text-dimmed">
        {{ t('user.profile.memberSince') }} {{ joinDate }}
      </span>
      <a
        :href="githubUrl"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 text-xs text-muted hover:text-highlighted transition-colors"
      >
        <UIcon
          name="i-lucide-external-link"
          class="size-3"
        />
        {{ t('user.profile.openOnGitHub') }}
      </a>
    </div>
  </div>
</template>
