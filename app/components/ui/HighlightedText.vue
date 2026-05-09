<script setup lang="ts">
const props = defineProps<{
  text: string
  query?: string | null
}>()

const parts = computed(() => highlightMatches(props.text, props.query))
</script>

<template>
  <span>
    <template
      v-for="(part, i) in parts"
      :key="i"
    >
      <mark
        v-if="part.match"
        class="bg-warning/30 text-default rounded-sm px-0.5"
      >{{ part.text }}</mark>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>
