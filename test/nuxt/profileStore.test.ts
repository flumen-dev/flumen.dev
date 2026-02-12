import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { GitHubProfile, GitHubEmail } from '../../shared/types/profile'

const mockProfile: GitHubProfile = {
  login: 'testuser',
  name: 'Test User',
  avatarUrl: 'https://avatars.githubusercontent.com/u/1',
  bio: 'Hello',
  company: null,
  location: 'Berlin',
  blog: null,
  twitterUsername: null,
  email: 'test@example.com',
  hireable: false,
}

const mockEmails: GitHubEmail[] = [
  { email: 'test@example.com', primary: true, verified: true, visibility: 'private' },
]

const mockSocials = [
  { provider: 'github', url: 'https://github.com/testuser' },
  { provider: 'x', url: 'https://x.com/testuser' },
]

registerEndpoint('/api/user/profile', { method: 'GET', handler: () => mockProfile })
registerEndpoint('/api/user/emails', { method: 'GET', handler: () => mockEmails })
registerEndpoint('/api/user/social-accounts', { method: 'GET', handler: () => mockSocials })
registerEndpoint('/api/user/readme', { method: 'GET', handler: () => ({ content: '# Hello World', sha: 'abc123' }) })
registerEndpoint('/api/user/readme', { method: 'PUT', handler: () => ({ sha: 'def456' }) })
registerEndpoint('/api/user/profile', { method: 'PATCH', handler: () => ({ ...mockProfile, name: 'Updated' }) })
registerEndpoint('/api/user/emails/visibility', { method: 'PATCH', handler: () => ({}) })
registerEndpoint('/api/user/social-accounts', { method: 'DELETE', handler: () => ({}) })

async function withStore<T>(fn: (store: ReturnType<typeof useProfileStore>) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      const store = useProfileStore()
      // Manual reset (setup stores don't support $reset)
      store.profile = null
      store.emails = []
      store.socials = []
      store.readme = null
      store.readmeSha = null
      store.loaded = false
      result = await fn(store)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('profileStore', () => {
  it('fetchAll loads data and sets loaded flag', async () => {
    await withStore(async (store) => {
      await store.fetchAll()
      expect(store.loaded).toBe(true)
      expect(store.profile?.login).toBe('testuser')
      expect(store.emails).toHaveLength(1)
      expect(store.socials).toHaveLength(2)
    })
  })

  it('fetchAll skips API calls when already loaded', async () => {
    await withStore(async (store) => {
      await store.fetchAll()
      store.profile = { ...mockProfile, name: 'Modified locally' }
      await store.fetchAll() // should not overwrite
      expect(store.profile?.name).toBe('Modified locally')
    })
  })

  it('removeSocialAccount updates state locally', async () => {
    await withStore(async (store) => {
      await store.fetchAll()
      await store.removeSocialAccount('https://github.com/testuser')
      expect(store.socials).toHaveLength(1)
      expect(store.socials[0]?.url).toBe('https://x.com/testuser')
    })
  })

  it('canAddSocial returns false at 4 accounts', async () => {
    await withStore((store) => {
      store.socials = [
        { provider: 'a', url: 'https://a.com' },
        { provider: 'b', url: 'https://b.com' },
        { provider: 'c', url: 'https://c.com' },
      ]
      expect(store.canAddSocial).toBe(true)
      store.socials.push({ provider: 'd', url: 'https://d.com' })
      expect(store.canAddSocial).toBe(false)
    })
  })

  it('toggleEmailVisibility flips visibility locally', async () => {
    await withStore(async (store) => {
      await store.fetchAll()
      expect(store.emailIsPublic).toBe(false)
      await store.toggleEmailVisibility()
      expect(store.primaryEmail?.visibility).toBe('public')
    })
  })

  it('saveProfile updates profile from response', async () => {
    await withStore(async (store) => {
      await store.fetchAll()
      const result = await store.saveProfile({ name: 'Updated' })
      expect(result).toBe(true)
      expect(store.profile?.name).toBe('Updated')
    })
  })

  it('fetchAll loads readme content and sha', async () => {
    await withStore(async (store) => {
      await store.fetchAll()
      expect(store.readme).toBe('# Hello World')
      expect(store.readmeSha).toBe('abc123')
    })
  })

  it('saveReadme updates content and sha from response', async () => {
    await withStore(async (store) => {
      await store.fetchAll()
      await store.saveReadme('# Updated')
      expect(store.readme).toBe('# Updated')
      expect(store.readmeSha).toBe('def456')
    })
  })

  it('saveReadme does nothing without sha', async () => {
    await withStore(async (store) => {
      store.readme = '# Test'
      store.readmeSha = null
      await store.saveReadme('# Changed')
      expect(store.readme).toBe('# Test')
    })
  })
})
