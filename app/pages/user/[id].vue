<script setup lang="ts">
import type { SocialProvider } from '~~/shared/socialProviders'

definePageMeta({
  titleKey: 'nav.profile',
  middleware: 'auth',
})

const { t } = useI18n()
const store = useProfileStore()

await store.fetchAll()

// --- Edit mode ---
const editing = ref(false)

const form = reactive({
  name: '',
  bio: '',
  company: '',
  location: '',
  blog: '',
  twitterUsername: '',
})
const readmeForm = ref('')
const readmePreview = ref(false)

function startEdit() {
  if (!store.profile) return
  form.name = store.profile.name ?? ''
  form.bio = store.profile.bio ?? ''
  form.company = store.profile.company ?? ''
  form.location = store.profile.location ?? ''
  form.blog = store.profile.blog ?? ''
  form.twitterUsername = store.profile.twitterUsername ?? ''
  readmeForm.value = store.readme ?? ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  readmePreview.value = false
  cancelAddSocial()
}

async function save() {
  const readmeChanged = store.readme !== null && readmeForm.value !== store.readme
  const [profileSuccess] = await Promise.all([
    store.saveProfile(form),
    readmeChanged ? store.saveReadme(readmeForm.value) : Promise.resolve(),
  ])
  if (profileSuccess) editing.value = false
}

// --- Social accounts UI ---
const addingUrl = ref('')
const addingProvider = ref<SocialProvider | null>(null)

function selectProvider(provider: SocialProvider) {
  addingProvider.value = provider
  addingUrl.value = provider.baseUrl
}

function cancelAddSocial() {
  addingProvider.value = null
  addingUrl.value = ''
}

async function addSocial() {
  if (!addingUrl.value || addingUrl.value === addingProvider.value?.baseUrl) return
  const success = await store.addSocialAccount(addingUrl.value)
  if (success) cancelAddSocial()
}

const allowedSchemes = new Set(['http:', 'https:', 'mailto:'])

function sanitizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    return allowedSchemes.has(url.protocol) ? url.href : null
  }
  catch {
    return null
  }
}
</script>

<template>
  <div class="px-4 py-8 sm:px-8 lg:px-12">
    <div class="mx-auto max-w-7xl">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row items-center gap-6">
        <div class="relative shrink-0">
          <UAvatar
            :src="store.profile?.avatarUrl"
            :alt="store.profile?.name ?? store.profile?.login ?? ''"
            size="3xl"
          />
          <a
            v-if="editing"
            href="https://github.com/settings/profile"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-2 block text-center text-xs text-muted hover:text-highlighted"
          >
            {{ t('profile.changeAvatar') }}
          </a>
        </div>

        <div class="flex-1 min-w-0 text-center sm:text-left">
          <h1 class="text-xl font-semibold truncate">
            {{ store.profile?.name ?? store.profile?.login }}
          </h1>
          <p class="text-sm text-muted truncate">
            @{{ store.profile?.login }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            v-if="editing"
            icon="i-lucide-check"
            :label="t('profile.save')"
            :loading="store.saving"
            @click="save"
          />
          <UButton
            :icon="editing ? 'i-lucide-x' : 'i-lucide-pencil'"
            :label="editing ? t('profile.cancel') : t('profile.edit')"
            variant="outline"
            :color="editing ? 'error' : undefined"
            @click="editing ? cancelEdit() : startEdit()"
          />
        </div>
      </div>

      <!-- Two-column layout: profile left, README right -->
      <div class="mt-8 flex flex-col xl:flex-row gap-10">
        <!-- Left column: Profile Fields + Contact + Socials -->
        <div class="flex-1/3 min-w-0 max-w-3xl space-y-5">
          <div>
            <label class="text-sm font-medium mb-1.5 block">{{ t('profile.name') }}</label>
            <UInput
              :model-value="editing ? form.name : (store.profile?.name ?? '')"
              icon="i-lucide-user"
              class="w-full"
              :disabled="!editing"
              @update:model-value="form.name = $event"
            />
          </div>

          <div>
            <label class="text-sm font-medium mb-1.5 block">{{ t('profile.bio') }}</label>
            <UTextarea
              :model-value="editing ? form.bio : (store.profile?.bio ?? '')"
              :rows="4"
              class="w-full"
              :disabled="!editing"
              @update:model-value="form.bio = $event"
            />
          </div>

          <div>
            <label class="text-sm font-medium mb-1.5 block">{{ t('profile.company') }}</label>
            <UInput
              :model-value="editing ? form.company : (store.profile?.company ?? '')"
              icon="i-lucide-building-2"
              class="w-full"
              :disabled="!editing"
              @update:model-value="form.company = $event"
            />
          </div>

          <div>
            <label class="text-sm font-medium mb-1.5 block">{{ t('profile.location') }}</label>
            <UInput
              :model-value="editing ? form.location : (store.profile?.location ?? '')"
              icon="i-lucide-map-pin"
              class="w-full"
              :disabled="!editing"
              @update:model-value="form.location = $event"
            />
          </div>

          <div>
            <label class="text-sm font-medium mb-1.5 block">{{ t('profile.website') }}</label>
            <UInput
              :model-value="editing ? form.blog : (store.profile?.blog ?? '')"
              icon="i-lucide-link"
              type="url"
              class="w-full"
              :disabled="!editing"
              @update:model-value="form.blog = $event"
            />
          </div>

          <div>
            <label class="text-sm font-medium mb-1.5 block">{{ t('profile.twitter') }}</label>
            <UInput
              :model-value="editing ? form.twitterUsername : (store.profile?.twitterUsername ?? '')"
              icon="i-lucide-at-sign"
              class="w-full"
              :disabled="!editing"
              @update:model-value="form.twitterUsername = $event"
            />
          </div>

          <!-- Contact & Availability -->
          <div class="mt-5">
            <h2 class="text-lg font-semibold mb-6">
              {{ t('profile.contactAvailability') }}
            </h2>

            <div class="space-y-4">
              <!-- Email visibility -->
              <div
                class="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 transition-opacity"
                :class="{ 'opacity-50 pointer-events-none': !editing }"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <UIcon
                    :name="store.emailIsPublic ? 'i-lucide-globe' : 'i-lucide-lock'"
                    class="size-5 shrink-0"
                    :class="store.emailIsPublic ? 'text-success' : 'text-muted'"
                  />
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate">
                      {{ store.primaryEmail?.email ?? '—' }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ store.emailIsPublic ? t('profile.emailVisibility') : t('profile.emailHidden') }}
                    </p>
                  </div>
                </div>
                <UButton
                  :label="store.emailIsPublic ? t('profile.emailPublic') : t('profile.emailPrivate')"
                  :icon="store.emailIsPublic ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                  :color="store.emailIsPublic ? 'success' : 'neutral'"
                  variant="soft"
                  size="sm"
                  :loading="store.togglingEmail"
                  :disabled="!editing"
                  @click="store.toggleEmailVisibility"
                />
              </div>

              <!-- Hireable -->
              <div
                class="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 transition-opacity"
                :class="{ 'opacity-50 pointer-events-none': !editing }"
              >
                <div class="flex items-center gap-3">
                  <UIcon
                    name="i-lucide-briefcase"
                    class="size-5 shrink-0"
                    :class="store.profile?.hireable ? 'text-primary' : 'text-muted'"
                  />
                  <div>
                    <p class="text-sm font-medium">
                      {{ t('profile.hireable') }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ store.profile?.hireable ? t('profile.hireableOn') : t('profile.hireableOff') }}
                    </p>
                  </div>
                </div>
                <USwitch
                  :model-value="store.profile?.hireable ?? false"
                  :loading="store.togglingHireable"
                  :disabled="!editing"
                  :aria-label="t('profile.hireable')"
                  @update:model-value="store.toggleHireable"
                />
              </div>
            </div>
          </div>

          <!-- Social Accounts -->
          <div class="mt-5">
            <h2 class="text-lg font-semibold mb-6">
              {{ t('profile.socialAccounts') }}
            </h2>

            <div class="space-y-3">
              <!-- Existing accounts -->
              <div
                v-for="social in store.socialsWithIcons"
                :key="social.url"
                class="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3 group"
              >
                <UIcon
                  :name="social.icon"
                  class="size-5 shrink-0"
                  :style="social.hex ? { color: social.hex } : undefined"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium">
                    {{ social.name }}
                  </p>
                  <a
                    v-if="sanitizeUrl(social.url)"
                    :href="sanitizeUrl(social.url)!"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-xs text-muted hover:text-highlighted truncate block"
                  >
                    {{ social.url }}
                  </a>
                  <span
                    v-else
                    class="text-xs text-muted truncate block"
                  >
                    {{ social.url }}
                  </span>
                </div>
                <UButton
                  v-if="editing"
                  icon="i-lucide-x"
                  variant="ghost"
                  color="error"
                  size="xs"
                  square
                  class="opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="store.removeSocialAccount(social.url)"
                />
              </div>

              <!-- Empty state -->
              <p
                v-if="!store.socials.length && !addingProvider"
                class="text-sm text-muted py-2"
              >
                {{ t('profile.noSocials') }}
              </p>

              <!-- Add new -->
              <div
                v-if="addingProvider"
                class="rounded-lg bg-muted/50 px-4 py-3 space-y-3"
              >
                <div class="flex items-center gap-3">
                  <UIcon
                    :name="addingProvider.icon"
                    class="size-5 shrink-0"
                    :style="addingProvider.hex ? { color: addingProvider.hex } : undefined"
                  />
                  <span class="text-sm font-medium">{{ addingProvider.name }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <UInput
                    v-model="addingUrl"
                    class="w-full"
                    :placeholder="addingProvider.baseUrl + addingProvider.placeholder"
                    autofocus
                    @keyup.enter="addSocial"
                  />
                  <UButton
                    icon="i-lucide-check"
                    :loading="store.addingSocial"
                    size="sm"
                    square
                    @click="addSocial"
                  />
                  <UButton
                    icon="i-lucide-x"
                    variant="ghost"
                    color="error"
                    size="sm"
                    square
                    @click="cancelAddSocial"
                  />
                </div>
              </div>

              <!-- Add button with provider dropdown -->
              <UDropdownMenu
                v-if="editing && !addingProvider && store.canAddSocial"
                :items="store.availableProviders.map(p => ({
                  label: p.name,
                  icon: p.icon,
                  onSelect: () => selectProvider(p),
                }))"
                :content="{ align: 'start' }"
              >
                <UButton
                  icon="i-lucide-plus"
                  :label="t('profile.addSocial')"
                  variant="outline"
                  color="neutral"
                  block
                />
              </UDropdownMenu>

              <p
                v-if="editing && !addingProvider && !store.canAddSocial"
                class="text-xs text-muted py-2"
              >
                {{ t('profile.socialLimit') }}
              </p>
            </div>
          </div>
        </div><!-- /left column -->

        <!-- Right column: Profile README -->
        <div class="flex-2/3 min-w-0">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">
              {{ t('profile.readme') }}
            </h2>
            <UButton
              v-if="editing && store.readme !== null"
              :icon="readmePreview ? 'i-lucide-code' : 'i-lucide-eye'"
              :label="readmePreview ? t('profile.readmeEdit') : t('profile.readmePreviewLabel')"
              variant="ghost"
              size="sm"
              @click="readmePreview = !readmePreview"
            />
          </div>

          <!-- View mode: rendered markdown -->
          <template v-if="!editing">
            <UEditor
              v-if="store.readme !== null"
              :model-value="store.readme"
              content-type="markdown"
              :editable="false"
            />
            <UAlert
              v-else-if="!store.readmeLoading"
              icon="i-lucide-file-text"
              color="neutral"
              variant="subtle"
              :title="t('profile.readmeNoRepo')"
              :description="t('profile.readmeNoRepoDescription')"
            >
              <template #actions>
                <UButton
                  :label="t('profile.readmeCreateLink')"
                  icon="i-lucide-external-link"
                  variant="outline"
                  color="neutral"
                  size="sm"
                  to="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme"
                  target="_blank"
                />
              </template>
            </UAlert>
          </template>

          <!-- Edit mode -->
          <template v-else>
            <template v-if="store.readme !== null">
              <!-- Preview -->
              <UEditor
                v-if="readmePreview"
                :model-value="readmeForm"
                content-type="markdown"
                :editable="false"
              />
              <!-- Raw editor -->
              <UTextarea
                v-else
                v-model="readmeForm"
                class="w-full font-mono text-sm"
                :rows="49"
                :placeholder="t('profile.readmePlaceholder')"
              />
            </template>
            <UAlert
              v-else
              icon="i-lucide-file-text"
              color="neutral"
              variant="subtle"
              :title="t('profile.readmeNoRepo')"
              :description="t('profile.readmeNoRepoDescription')"
            >
              <template #actions>
                <UButton
                  :label="t('profile.readmeCreateLink')"
                  icon="i-lucide-external-link"
                  variant="outline"
                  color="neutral"
                  size="sm"
                  to="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme"
                  target="_blank"
                />
              </template>
            </UAlert>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
