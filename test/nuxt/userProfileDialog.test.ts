import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { UserProfileData } from '../../app/composables/useUserProfileDialog'

const mockProfileData: UserProfileData = {
  login: 'octocat',
  name: 'The Octocat',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
  pronouns: 'he/him',
  bio: 'GitHub mascot',
  status: { emoji: ':octocat:', message: 'Working on stuff', limitedAvailability: false, expiresAt: null },
  company: '@github',
  location: 'San Francisco',
  blog: 'https://github.blog',
  twitterUsername: null,
  email: null,
  hireable: null,
  followers: 1000,
  following: 5,
  publicRepos: 8,
  createdAt: '2011-01-25T00:00:00Z',
  topRepos: [
    { name: 'Hello-World', fullName: 'octocat/Hello-World', description: 'My first repo', stars: 2500, language: 'Ruby', fork: false },
    { name: 'Spoon-Knife', fullName: 'octocat/Spoon-Knife', description: 'Fork practice', stars: 12000, language: null, fork: true },
  ],
}

registerEndpoint('/api/user/profile', {
  method: 'GET',
  handler: () => mockProfileData,
})

registerEndpoint('/api/user/contributions', {
  method: 'GET',
  handler: () => ({
    totalContributions: 365,
    weeks: [
      [
        { date: '2025-03-02', count: 5 },
        { date: '2025-03-03', count: 0 },
        { date: '2025-03-04', count: 12 },
      ],
    ],
  }),
})

async function withDialog<T>(fn: (dialog: ReturnType<typeof useUserProfileDialog>) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      const dialog = useUserProfileDialog()
      dialog.isOpen.value = false
      dialog.activeLogin.value = null
      dialog.profile.value = null
      dialog.loading.value = false
      dialog.error.value = false
      result = await fn(dialog)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('useUserProfileDialog', () => {
  it('starts with closed state', async () => {
    await withDialog((dialog) => {
      expect(dialog.isOpen.value).toBe(false)
      expect(dialog.profile.value).toBeNull()
      expect(dialog.loading.value).toBe(false)
      expect(dialog.error.value).toBe(false)
    })
  })

  it('open() sets isOpen and activeLogin immediately', async () => {
    await withDialog(async (dialog) => {
      const promise = dialog.open('octocat')
      expect(dialog.isOpen.value).toBe(true)
      expect(dialog.activeLogin.value).toBe('octocat')
      expect(dialog.loading.value).toBe(true)
      await promise
      expect(dialog.loading.value).toBe(false)
    })
  })

  it('open() loads profile data', async () => {
    await withDialog(async (dialog) => {
      await dialog.open('octocat')
      expect(dialog.profile.value).not.toBeNull()
      expect(dialog.profile.value?.login).toBe('octocat')
      expect(dialog.profile.value?.name).toBe('The Octocat')
      expect(dialog.profile.value?.topRepos).toHaveLength(2)
      expect(dialog.profile.value?.followers).toBe(1000)
    })
  })

  it('close() resets isOpen', async () => {
    await withDialog(async (dialog) => {
      await dialog.open('octocat')
      expect(dialog.isOpen.value).toBe(true)
      dialog.close()
      expect(dialog.isOpen.value).toBe(false)
    })
  })

  it('open() clears previous profile before loading', async () => {
    await withDialog(async (dialog) => {
      // Set a fake previous profile
      dialog.profile.value = mockProfileData
      expect(dialog.profile.value).not.toBeNull()

      const promise = dialog.open('octocat')
      // Profile should be null immediately after calling open
      expect(dialog.profile.value).toBeNull()
      await promise
    })
  })
})
