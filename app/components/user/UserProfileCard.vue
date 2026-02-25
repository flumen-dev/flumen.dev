<script setup lang="ts">
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
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-start gap-4">
      <UAvatar
        :src="profile.avatarUrl"
        :alt="profile.login"
        size="xl"
        class="ring-2 ring-default"
      />
      <div class="min-w-0 flex-1">
        <h2
          v-if="profile.name"
          class="text-lg font-semibold text-highlighted truncate"
        >
          {{ profile.name }}
        </h2>
        <p class="text-sm text-muted truncate">
          @{{ profile.login }}
        </p>
        <p
          v-if="profile.bio"
          class="mt-1.5 text-sm text-default leading-relaxed"
        >
          {{ profile.bio }}
        </p>
      </div>
    </div>

    <!-- Stats row -->
    <div class="flex items-center gap-5 text-sm">
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-highlighted">{{ profile.followers }}</span>
        <span class="text-muted">{{ t('user.profile.followers') }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-highlighted">{{ profile.following }}</span>
        <span class="text-muted">{{ t('user.profile.following') }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-highlighted">{{ profile.publicRepos }}</span>
        <span class="text-muted">{{ t('user.profile.repositories') }}</span>
      </div>
    </div>

    <!-- Details -->
    <div
      v-if="profile.company || profile.location || links.length > 0"
      class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted"
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

    <!-- Top Repos -->
    <div
      v-if="profile.topRepos?.length"
      class="space-y-2"
    >
      <h3 class="text-xs font-semibold text-muted uppercase tracking-wide">
        {{ t('user.profile.topRepos') }}
      </h3>
      <div class="grid grid-cols-2 gap-2">
        <a
          v-for="repo in profile.topRepos"
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
