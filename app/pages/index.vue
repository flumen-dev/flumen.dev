<script setup lang="ts">
const { loggedIn } = useUserSession()
const localePath = useLocalePath()

definePageMeta({
  layout: false,
})

// Logged-in users land on Focus
if (loggedIn.value) {
  await navigateTo(localePath('/focus'), { redirectCode: 302 })
}
</script>

<template>
  <UiWelcomeScreen v-if="!loggedIn" />
</template>
