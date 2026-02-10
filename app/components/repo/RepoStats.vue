<script setup lang="ts">
defineProps<{
  repo: Repository
}>()
</script>

<template>
  <div class="flex items-center gap-3 text-xs text-toned">
    <!-- Language -->
    <span
      v-if="repo.language"
      class="flex items-center gap-1"
    >
      <span
        class="size-2.5 rounded-full shrink-0"
        :style="{ backgroundColor: getLanguageColor(repo.language) }"
      />
      {{ repo.language }}
    </span>

    <!-- Stars -->
    <span
      v-if="repo.stargazersCount"
      class="flex items-center gap-1"
    >
      <UIcon
        name="i-lucide-star"
        class="size-3.5"
      />
      {{ repo.stargazersCount }}
    </span>

    <!-- Forks -->
    <span
      v-if="repo.forksCount"
      class="flex items-center gap-1"
    >
      <UIcon
        name="i-lucide-git-fork"
        class="size-3.5"
      />
      {{ repo.forksCount }}
    </span>

    <!-- Topics (pushed right) -->
    <div
      v-if="repo.topics.length"
      class="flex items-center gap-1 ml-auto"
    >
      <UBadge
        v-for="topic in repo.topics.slice(0, 3)"
        :key="topic"
        color="primary"
        variant="subtle"
        size="xs"
      >
        {{ topic }}
      </UBadge>
      <span
        v-if="repo.topics.length > 3"
        class="text-dimmed"
      >
        +{{ repo.topics.length - 3 }}
      </span>
    </div>
  </div>
</template>
