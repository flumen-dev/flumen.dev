<script setup lang="ts">
import { VuemojiPicker } from 'vuemoji-picker'
import githubEmojiDataUrl from 'emoji-picker-element-data/en/github/data.json?url'
import { STATUS_PRESETS, expiryToDate, shortcodeToUnicode, type ExpiryOption } from '~~/shared/types/status'

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const colorMode = useColorMode()
const profileStore = useProfileStore()

// Internal state — shortcode for API, unicode for display
const emojiShortcode = ref('')
const emojiDisplay = computed(() => shortcodeToUnicode(emojiShortcode.value) || '')
const message = ref('')
const busy = ref(false)
const expiry = ref<ExpiryOption>('never')
const pickerOpen = ref(false)

const expiryOptions = computed(() => [
  { label: t('status.expiry.30m'), value: '30m' as ExpiryOption },
  { label: t('status.expiry.1h'), value: '1h' as ExpiryOption },
  { label: t('status.expiry.4h'), value: '4h' as ExpiryOption },
  { label: t('status.expiry.today'), value: 'today' as ExpiryOption },
  { label: t('status.expiry.week'), value: 'week' as ExpiryOption },
  { label: t('status.expiry.never'), value: 'never' as ExpiryOption },
])

const hasStatus = computed(() => profileStore.status?.emoji || profileStore.status?.message)

watch(open, (isOpen) => {
  if (isOpen) {
    const s = profileStore.status
    emojiShortcode.value = s?.emoji ?? ''
    message.value = s?.message ?? ''
    busy.value = s?.limitedAvailability ?? false
    expiry.value = 'never'
    pickerOpen.value = false
  }
})

function onEmojiClick(event: { emoji: { shortcodes?: string[], unicode: string }, unicode: string }) {
  const shortcode = event.emoji.shortcodes?.[0]
  emojiShortcode.value = shortcode ? `:${shortcode}:` : event.unicode
  pickerOpen.value = false
}

function applyPreset(preset: typeof STATUS_PRESETS[number]) {
  emojiShortcode.value = preset.emoji
  message.value = t(`status.presets.${preset.key}`)
  busy.value = preset.busy
  expiry.value = preset.expiresIn ?? 'never'
}

async function save() {
  const ok = await profileStore.updateStatus({
    emoji: emojiShortcode.value || null,
    message: message.value || null,
    limitedAvailability: busy.value,
    expiresAt: expiryToDate(expiry.value),
  })
  if (ok) open.value = false
}

async function clear() {
  const ok = await profileStore.clearStatus()
  if (ok) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('status.title')"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Current status info -->
        <div
          v-if="hasStatus"
          class="rounded-lg bg-elevated px-3 py-2"
        >
          <UiStatusBadge />
        </div>

        <!-- Presets -->
        <div class="flex flex-wrap gap-1.5">
          <UButton
            v-for="preset in STATUS_PRESETS"
            :key="preset.key"
            size="xs"
            variant="soft"
            color="neutral"
            @click="applyPreset(preset)"
          >
            {{ preset.emojiUnicode }} {{ t(`status.presets.${preset.key}`) }}
          </UButton>
        </div>

        <!-- Emoji picker + Message -->
        <div class="flex items-center gap-2">
          <UPopover v-model:open="pickerOpen">
            <UButton
              variant="outline"
              color="neutral"
              square
              class="text-xl"
            >
              <UIcon
                v-if="!emojiDisplay"
                name="i-lucide-smile-plus"
                class="size-5"
              />
              <template v-else>
                {{ emojiDisplay }}
              </template>
            </UButton>

            <template #content>
              <ClientOnly>
                <VuemojiPicker
                  :is-dark="colorMode.value === 'dark'"
                  :data-source="githubEmojiDataUrl"
                  @emoji-click="onEmojiClick"
                />
              </ClientOnly>
            </template>
          </UPopover>

          <UInput
            v-model="message"
            :placeholder="t('status.messagePlaceholder')"
            class="flex-1"
          />
        </div>

        <!-- Busy toggle -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">
              {{ t('status.busy') }}
            </p>
            <p class="text-xs text-muted">
              {{ t('status.busyHint') }}
            </p>
          </div>
          <USwitch v-model="busy" />
        </div>

        <!-- Expiry -->
        <div>
          <p class="text-sm font-medium mb-1.5">
            {{ t('status.clearAfter') }}
          </p>
          <URadioGroup
            v-model="expiry"
            :items="expiryOptions"
            orientation="horizontal"
            :ui="{ fieldset: 'flex flex-wrap gap-2' }"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center gap-2 justify-between w-full">
        <UButton
          v-if="hasStatus"
          :label="t('status.clear')"
          variant="soft"
          color="error"
          :loading="profileStore.savingStatus"
          @click="clear"
        />
        <div class="flex-1" />
        <UButton
          :label="t('profile.cancel')"
          variant="ghost"
          color="neutral"
          @click="open = false"
        />
        <UButton
          :label="t('status.save')"
          :loading="profileStore.savingStatus"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
