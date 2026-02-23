<script setup lang="ts">
import type { RepoDetail } from '~~/shared/types/repository'

defineProps<{
  repo: RepoDetail
}>()

const { isPinned, toggle: togglePin } = usePinnedRepos()
</script>

<template>
  <div class="space-y-3">
    <!-- Name + badges -->
    <div class="flex items-center gap-2 flex-wrap">
      <UAvatar
        :src="repo.owner.avatarUrl"
        :alt="repo.owner.login"
        size="sm"
      />
      <h1 class="text-lg font-bold text-highlighted">
        <span class="text-muted font-normal">{{ repo.owner.login }}</span>
        <span class="text-muted font-normal mx-0.5">/</span>
        {{ repo.name }}
      </h1>

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
      <UBadge
        v-if="repo.isTemplate"
        color="primary"
        variant="subtle"
        size="xs"
      >
        {{ $t('repos.badge.template') }}
      </UBadge>
    </div>

    <!-- Description -->
    <p
      v-if="repo.description"
      class="text-sm text-muted"
    >
      {{ repo.description }}
    </p>

    <!-- Fork parent -->
    <p
      v-if="repo.parent"
      class="text-xs text-dimmed"
    >
      {{ $t('repos.detail.forkedFrom') }}
      <a
        :href="repo.parent.htmlUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary hover:underline"
      >
        {{ repo.parent.fullName }}
      </a>
    </p>

    <!-- Topics -->
    <div
      v-if="repo.topics.length"
      class="flex flex-wrap gap-1"
    >
      <UBadge
        v-for="topic in repo.topics"
        :key="topic"
        color="primary"
        variant="subtle"
        size="xs"
      >
        {{ topic }}
      </UBadge>
    </div>

    <!-- Action buttons -->
    <div class="flex items-center gap-2">
      <UButton
        :to="repo.htmlUrl"
        target="_blank"
        icon="i-lucide-external-link"
        size="xs"
        color="neutral"
        variant="outline"
      >
        {{ $t('repos.detail.viewOnGithub') }}
      </UButton>
      <UButton
        :icon="isPinned(repo.fullName) ? 'i-lucide-pin-off' : 'i-lucide-pin'"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="togglePin(repo.fullName, repo.fork ? 'fork' : 'repo')"
      >
        {{ isPinned(repo.fullName) ? $t('pinnedRepos.unpin') : $t('pinnedRepos.pin') }}
      </UButton>
    </div>
  </div>
</template>
