<script setup lang="ts">
defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()

type ThemeValue = 'light' | 'dark' | 'system'

const themeLabels = computed<Record<ThemeValue, string>>(() => ({
  light: t('theme.light'),
  dark: t('theme.dark'),
  system: t('theme.system'),
}))

const themes = [
  { value: 'light', icon: 'i-lucide-sun' },
  { value: 'dark', icon: 'i-lucide-moon' },
  { value: 'system', icon: 'i-lucide-monitor' },
] as const
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="t('settings.appearance.theme')"
    class="grid grid-cols-3 gap-3 max-w-md"
  >
    <button
      v-for="theme in themes"
      :key="theme.value"
      role="radio"
      :aria-checked="modelValue === theme.value"
      :aria-label="themeLabels[theme.value]"
      class="rounded-xl border-2 p-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
      :class="modelValue === theme.value
        ? 'border-primary bg-primary/5'
        : 'border-default hover:border-muted'"
      @click="emit('update:modelValue', theme.value)"
    >
      <!-- Mini preview -->
      <div class="aspect-4/3 rounded-lg overflow-hidden">
        <!-- Light -->
        <div
          v-if="theme.value === 'light'"
          class="h-full rounded-lg border border-gray-200 bg-white p-3 flex flex-col justify-center space-y-2"
        >
          <div class="h-2 w-3/5 rounded-full bg-gray-300" />
          <div class="h-1.5 w-full rounded-full bg-gray-200" />
          <div class="h-1.5 w-4/5 rounded-full bg-gray-200" />
        </div>

        <!-- Dark -->
        <div
          v-else-if="theme.value === 'dark'"
          class="h-full rounded-lg border border-gray-700 bg-gray-900 p-3 flex flex-col justify-center space-y-2"
        >
          <div class="h-2 w-3/5 rounded-full bg-gray-600" />
          <div class="h-1.5 w-full rounded-full bg-gray-700" />
          <div class="h-1.5 w-4/5 rounded-full bg-gray-700" />
        </div>

        <!-- System (split) -->
        <div
          v-else
          class="h-full rounded-lg overflow-hidden border border-gray-200 flex"
        >
          <div class="w-1/2 bg-white" />
          <div class="w-1/2 bg-gray-900" />
        </div>
      </div>

      <!-- Label -->
      <div class="flex items-center justify-center gap-1.5 pt-2.5 pb-0.5">
        <UIcon
          :name="theme.icon"
          class="size-4"
        />
        <span class="text-sm font-medium">{{ themeLabels[theme.value] }}</span>
      </div>
    </button>
  </div>
</template>
