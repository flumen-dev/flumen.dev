import type { GitHubProfile, GitHubEmail } from '~~/shared/types/profile'
import { socialProviders, detectProvider } from '~~/shared/socialProviders'

interface SocialAccount {
  provider: string
  url: string
}

export const useProfileStore = defineStore('profile', () => {
  const { t } = useI18n()
  const toast = useToast()
  const apiFetch = useRequestFetch()

  // --- State ---
  const profile = ref<GitHubProfile | null>(null)
  const emails = ref<GitHubEmail[]>([])
  const socials = ref<SocialAccount[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const togglingEmail = ref(false)
  const togglingHireable = ref(false)
  const addingSocial = ref(false)

  // --- Computed ---
  const primaryEmail = computed(() => emails.value.find(e => e.primary))
  const emailIsPublic = computed(() => primaryEmail.value?.visibility === 'public')

  const socialsWithIcons = computed(() =>
    socials.value.map(s => ({
      ...s,
      ...detectProvider(s.url),
    })),
  )

  const availableProviders = computed(() =>
    socialProviders.filter(p =>
      !socials.value.some(s => detectProvider(s.url).id === p.id),
    ),
  )

  const canAddSocial = computed(() => socials.value.length < 4)

  // --- Error handler ---
  function handleError(key: string, err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 401) {
      toast.add({ title: t('profile.error.sessionExpired'), color: 'error', icon: 'i-lucide-log-out' })
      return
    }
    if (status === 403) {
      toast.add({ title: t('profile.error.rateLimited'), color: 'warning', icon: 'i-lucide-clock' })
      return
    }
    toast.add({ title: t(key), color: 'error', icon: 'i-lucide-circle-alert' })
  }

  function showSuccess(key: string) {
    toast.add({ title: t(key), color: 'success', icon: 'i-lucide-check' })
  }

  // --- Actions ---
  async function fetchAll() {
    if (loaded.value) return
    loading.value = true
    try {
      const [p, e, s] = await Promise.all([
        apiFetch('/api/user/profile'),
        apiFetch<GitHubEmail[]>('/api/user/emails'),
        apiFetch<SocialAccount[]>('/api/user/social-accounts'),
      ])
      profile.value = p as GitHubProfile
      emails.value = e
      socials.value = s
      loaded.value = true
    }
    catch (err) {
      handleError('profile.error.loadFailed', err)
    }
    finally {
      loading.value = false
    }
  }

  async function saveProfile(form: Partial<GitHubProfile>) {
    saving.value = true
    try {
      const updated = await apiFetch('/api/user/profile', { method: 'PATCH', body: form })
      profile.value = updated as GitHubProfile
      showSuccess('profile.success.saved')
      return true
    }
    catch (err) {
      handleError('profile.error.saveFailed', err)
      return false
    }
    finally {
      saving.value = false
    }
  }

  async function toggleHireable() {
    togglingHireable.value = true
    try {
      const updated = await apiFetch('/api/user/profile', {
        method: 'PATCH',
        body: { hireable: !profile.value?.hireable },
      })
      profile.value = updated as GitHubProfile
      showSuccess('profile.success.hireableToggled')
    }
    catch (err) {
      handleError('profile.error.hireableFailed', err)
    }
    finally {
      togglingHireable.value = false
    }
  }

  async function toggleEmailVisibility() {
    togglingEmail.value = true
    try {
      const newVisibility = emailIsPublic.value ? 'private' : 'public'
      await apiFetch('/api/user/emails/visibility', {
        method: 'PATCH',
        body: { visibility: newVisibility },
      })
      // Update locally instead of re-fetching
      const email = emails.value.find(e => e.primary)
      if (email) email.visibility = newVisibility
      showSuccess('profile.success.emailToggled')
    }
    catch (err) {
      handleError('profile.error.emailToggleFailed', err)
    }
    finally {
      togglingEmail.value = false
    }
  }

  async function addSocialAccount(url: string) {
    addingSocial.value = true
    try {
      const added = await apiFetch<SocialAccount[]>('/api/user/social-accounts', { method: 'POST', body: { url } })
      // API returns the newly added accounts — append to local state
      socials.value.push(...added)
      showSuccess('profile.success.socialAdded')
      return true
    }
    catch (err) {
      handleError('profile.error.addSocialFailed', err)
      return false
    }
    finally {
      addingSocial.value = false
    }
  }

  async function removeSocialAccount(url: string) {
    try {
      await apiFetch('/api/user/social-accounts', { method: 'DELETE', body: { url } })
      socials.value = socials.value.filter(s => s.url !== url)
      showSuccess('profile.success.socialRemoved')
    }
    catch (err) {
      handleError('profile.error.removeSocialFailed', err)
    }
  }

  return {
    // State
    profile,
    emails,
    socials,
    loaded,
    loading,
    saving,
    togglingEmail,
    togglingHireable,
    addingSocial,
    // Computed
    primaryEmail,
    emailIsPublic,
    socialsWithIcons,
    availableProviders,
    canAddSocial,
    // Actions
    fetchAll,
    saveProfile,
    toggleHireable,
    toggleEmailVisibility,
    addSocialAccount,
    removeSocialAccount,
  }
})
