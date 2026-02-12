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
  const readme = ref<string | null>(null)
  const readmeSha = ref<string | null>(null)
  const readmeLoading = ref(false)
  const savingReadme = ref(false)

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
    toast.add({ title: t(`profile.error.${key}`), color: 'error', icon: 'i-lucide-circle-alert' })
  }

  function showSuccess(key: string) {
    toast.add({ title: t(`profile.success.${key}`), color: 'success', icon: 'i-lucide-check' })
  }

  // --- Actions ---
  async function fetchReadme() {
    readmeLoading.value = true
    try {
      const data = await apiFetch<{ content: string | null, sha: string | null }>('/api/user/readme')
      readme.value = data.content
      readmeSha.value = data.sha
    }
    catch (err) {
      handleError('loadFailed', err)
    }
    finally {
      readmeLoading.value = false
    }
  }

  async function fetchAll() {
    if (loaded.value) return
    loading.value = true
    try {
      const [p, e, s] = await Promise.all([
        apiFetch('/api/user/profile'),
        apiFetch<GitHubEmail[]>('/api/user/emails'),
        apiFetch<SocialAccount[]>('/api/user/social-accounts'),
        fetchReadme(),
      ])
      profile.value = p as GitHubProfile
      emails.value = e
      socials.value = s
      loaded.value = true
    }
    catch (err) {
      handleError('loadFailed', err)
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
      showSuccess('saved')
      return true
    }
    catch (err) {
      handleError('saveFailed', err)
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
      showSuccess('hireableToggled')
    }
    catch (err) {
      handleError('hireableFailed', err)
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
      showSuccess('emailToggled')
    }
    catch (err) {
      handleError('emailToggleFailed', err)
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
      showSuccess('socialAdded')
      return true
    }
    catch (err) {
      handleError('addSocialFailed', err)
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
      showSuccess('socialRemoved')
    }
    catch (err) {
      handleError('removeSocialFailed', err)
    }
  }

  async function saveReadme(content: string) {
    if (!readmeSha.value) return
    savingReadme.value = true
    try {
      const { sha } = await apiFetch<{ sha: string }>('/api/user/readme', {
        method: 'PUT',
        body: { content, sha: readmeSha.value },
      })
      readme.value = content
      readmeSha.value = sha
      showSuccess('readmeSaved')
    }
    catch (err) {
      handleError('readmeSaveFailed', err)
    }
    finally {
      savingReadme.value = false
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
    readme,
    readmeSha,
    readmeLoading,
    savingReadme,
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
    saveReadme,
  }
})
