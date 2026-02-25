import type { GitHubProfile } from '~~/shared/types/profile'

const isOpen = ref(false)
const activeLogin = ref<string | null>(null)
const profile = ref<GitHubProfile | null>(null)
const loading = ref(false)
const error = ref(false)

export function useUserProfileDialog() {
  async function open(login: string) {
    activeLogin.value = login
    profile.value = null
    error.value = false
    isOpen.value = true
    loading.value = true

    try {
      profile.value = await useRequestFetch()<GitHubProfile>('/api/user/profile', {
        params: { login },
      })
    }
    catch {
      error.value = true
    }
    finally {
      loading.value = false
    }
  }

  function close() {
    isOpen.value = false
  }

  return {
    isOpen,
    activeLogin,
    profile,
    loading,
    error,
    open,
    close,
  }
}
