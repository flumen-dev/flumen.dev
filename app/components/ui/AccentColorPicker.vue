<script setup lang="ts">
import { accentColors, defaultUserSettings } from '~~/shared/types/settings'

const appConfig = useAppConfig()
const { update } = useUserSettings()

const defaultColor = defaultUserSettings.primaryColor

const currentColor = computed(() => appConfig.ui.colors.primary)
const isDefault = computed(() => currentColor.value === defaultColor)

function selectColor(color: string) {
  appConfig.ui.colors.primary = color
  update({ primaryColor: color })
}

function resetColor() {
  appConfig.ui.colors.primary = defaultColor
  update({ primaryColor: defaultColor })
}
</script>

<template>
  <UPopover>
    <slot>
      <UButton
        icon="i-lucide-palette"
        color="neutral"
        variant="ghost"
        square
      />
    </slot>

    <template #content>
      <div class="grid grid-cols-5 gap-2 p-3">
        <button
          class="size-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-center"
          :class="isDefault ? 'border-neutral-400 bg-muted' : 'border-default bg-muted'"
          aria-label="Default"
          @click="resetColor"
        >
          <UIcon
            v-if="isDefault"
            name="i-lucide-check"
            class="size-3.5 text-neutral-500"
          />
          <UIcon
            v-else
            name="i-lucide-ban"
            class="size-4 text-muted"
          />
        </button>

        <button
          v-for="color in accentColors"
          :key="color.name"
          :style="{ backgroundColor: color.hex }"
          class="size-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-center"
          :aria-label="color.name"
          @click="selectColor(color.name)"
        >
          <span
            v-if="currentColor === color.name"
            class="size-3 rounded-full bg-white"
          />
        </button>
      </div>
    </template>
  </UPopover>
</template>
