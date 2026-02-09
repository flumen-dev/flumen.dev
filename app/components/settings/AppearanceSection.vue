<script setup lang="ts">
import { accentColors, defaultUserSettings } from '~~/shared/types/settings'

const { locale, locales } = useI18n()
const { update } = useUserSettings()
const colorMode = useColorMode()
const appConfig = useAppConfig()

// Theme
const currentTheme = computed(() => colorMode.preference)

function selectTheme(theme: string) {
  colorMode.preference = theme
  update({ theme: theme as 'light' | 'dark' | 'system' })
}

// Accent Color
const defaultColor = defaultUserSettings.primaryColor
const currentColor = computed(() => appConfig.ui.colors.primary)
const isDefaultColor = computed(() => currentColor.value === defaultColor)

function selectColor(color: string) {
  appConfig.ui.colors.primary = color
  update({ primaryColor: color })
}

function resetColor() {
  appConfig.ui.colors.primary = defaultColor
  update({ primaryColor: defaultColor })
}

// Language
const localeItems = computed(() =>
  (locales.value as Array<{ code: string, name: string }>).map(l => ({
    label: l.name,
    value: l.code,
  })),
)

const switchLocalePath = useSwitchLocalePath()

function selectLocale(code: 'en' | 'de') {
  update({ locale: code })
  navigateTo(switchLocalePath(code))
}
</script>

<template>
  <section aria-labelledby="appearance-heading">
    <div class="mb-8">
      <h2
        id="appearance-heading"
        class="text-lg font-semibold"
      >
        {{ $t('settings.appearance.title') }}
      </h2>
      <p class="text-sm text-muted mt-1">
        {{ $t('settings.appearance.description') }}
      </p>
    </div>

    <div class="space-y-8">
      <!-- Theme -->
      <div>
        <h3 class="text-sm font-medium mb-3">
          {{ $t('settings.appearance.theme') }}
        </h3>
        <SettingsThemePicker
          :model-value="currentTheme"
          @update:model-value="selectTheme"
        />
      </div>

      <!-- Accent Color -->
      <div>
        <h3 class="text-sm font-medium mb-3">
          {{ $t('settings.appearance.accentColor') }}
        </h3>
        <div
          role="radiogroup"
          :aria-label="$t('settings.appearance.accentColor')"
          class="flex flex-wrap items-center gap-2"
        >
          <button
            class="size-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-center cursor-pointer"
            :class="isDefaultColor ? 'border-neutral-400 bg-muted' : 'border-default bg-muted'"
            :aria-label="$t('settings.appearance.resetColor')"
            @click="resetColor"
          >
            <UIcon
              v-if="isDefaultColor"
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
            role="radio"
            :aria-checked="currentColor === color.name"
            :aria-label="color.name"
            :class="color.class"
            class="size-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-center cursor-pointer"
            @click="selectColor(color.name)"
          >
            <span
              v-if="currentColor === color.name"
              class="size-3 rounded-full bg-white"
            />
          </button>
        </div>
      </div>

      <!-- Language -->
      <div>
        <label
          id="language-label"
          class="text-sm font-medium mb-3 block"
        >
          {{ $t('settings.appearance.language') }}
        </label>
        <USelect
          :model-value="locale"
          :items="localeItems"
          class="max-w-48"
          aria-labelledby="language-label"
          @update:model-value="selectLocale($event as 'en' | 'de')"
        />
      </div>
    </div>
  </section>
</template>
