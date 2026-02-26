<script setup lang="ts">
defineProps<{
  login: string
  avatarUrl?: string
  size?: '3xs' | '2xs' | 'xs'
}>()

const { open } = useUserProfileDialog()
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 cursor-pointer hover:underline"
    @click.stop="open(login)"
  >
    <UAvatar
      :src="avatarUrl ?? `https://github.com/${login}.png?size=40`"
      :alt="login"
      :size="size ?? '3xs'"
    />
    <span class="text-sm text-highlighted truncate">{{ login }}</span>
  </button>
</template>
