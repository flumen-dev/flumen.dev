<script setup lang="ts">
import type { GitHubProfile } from '~~/shared/types/profile'

const props = defineProps<{
  profile: GitHubProfile
}>()

const { t, d } = useI18n()

const joinDate = computed(() => d(new Date(props.profile.createdAt), 'short'))

const githubUrl = computed(() => `https://github.com/${props.profile.login}`)
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <UAvatar
        :src="profile.avatarUrl"
        :alt="profile.login"
        size="xl"
      />
      <div class="min-w-0">
        <h2
          v-if="profile.name"
          class="text-lg font-semibold text-highlighted truncate"
        >
          {{ profile.name }}
        </h2>
        <p class="text-sm text-muted truncate">
          @{{ profile.login }}
        </p>
      </div>
    </div>

    <!-- Bio -->
    <p
      v-if="profile.bio"
      class="text-sm text-default"
    >
      {{ profile.bio }}
    </p>

    <!-- Stats -->
    <div class="flex items-center gap-4 text-sm">
      <span class="text-highlighted font-medium">{{ profile.followers }}</span>
      <span class="text-muted">{{ t('user.profile.followers') }}</span>
      <span class="text-highlighted font-medium">{{ profile.following }}</span>
      <span class="text-muted">{{ t('user.profile.following') }}</span>
      <span class="text-highlighted font-medium">{{ profile.publicRepos }}</span>
      <span class="text-muted">{{ t('user.profile.repositories') }}</span>
    </div>

    <!-- Meta -->
    <div class="space-y-1.5 text-sm">
      <div
        v-if="profile.company"
        class="flex items-center gap-2 text-muted"
      >
        <UIcon
          name="i-lucide-building-2"
          class="size-4 shrink-0"
        />
        <span>{{ profile.company }}</span>
      </div>
      <div
        v-if="profile.location"
        class="flex items-center gap-2 text-muted"
      >
        <UIcon
          name="i-lucide-map-pin"
          class="size-4 shrink-0"
        />
        <span>{{ profile.location }}</span>
      </div>
      <div
        v-if="profile.blog"
        class="flex items-center gap-2 text-muted"
      >
        <UIcon
          name="i-lucide-link"
          class="size-4 shrink-0"
        />
        <a
          :href="profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline truncate"
        >
          {{ profile.blog }}
        </a>
      </div>
      <div
        v-if="profile.twitterUsername"
        class="flex items-center gap-2 text-muted"
      >
        <UIcon
          name="i-lucide-twitter"
          class="size-4 shrink-0"
        />
        <a
          :href="`https://x.com/${profile.twitterUsername}`"
          target="_blank"
          rel="noopener"
          class="text-primary hover:underline"
        >
          @{{ profile.twitterUsername }}
        </a>
      </div>
      <div class="flex items-center gap-2 text-muted">
        <UIcon
          name="i-lucide-calendar"
          class="size-4 shrink-0"
        />
        <span>{{ t('user.profile.memberSince') }} {{ joinDate }}</span>
      </div>
    </div>

    <!-- GitHub link -->
    <a
      :href="githubUrl"
      target="_blank"
      rel="noopener"
      class="inline-flex items-center gap-1.5 text-xs text-muted hover:text-highlighted transition-colors"
    >
      <UIcon
        name="i-lucide-external-link"
        class="size-3.5"
      />
      {{ t('user.profile.openOnGitHub') }}
    </a>
  </div>
</template>
