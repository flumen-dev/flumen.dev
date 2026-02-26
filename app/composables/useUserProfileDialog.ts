import type { GitHubProfile, ProfileRepo } from '~~/shared/types/profile'
import type { UserStatus } from '~~/shared/types/status'

export interface UserProfileData extends GitHubProfile {
  status: UserStatus | null
  topRepos: ProfileRepo[]
}

const isOpen = ref(false)
const activeLogin = ref<string | null>(null)
const profile = ref<UserProfileData | null>(null)
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
      profile.value = await useRequestFetch()<UserProfileData>('/api/user/profile', {
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
