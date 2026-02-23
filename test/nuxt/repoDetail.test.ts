import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { H3Event } from 'h3'
import type { RepoDetail, RepoHealthStats } from '../../shared/types/repository'

const mockRepoDetail: RepoDetail = {
  id: 1,
  name: 'demo',
  fullName: 'acme/demo',
  description: 'Demo repository',
  htmlUrl: 'https://github.com/acme/demo',
  language: 'TypeScript',
  visibility: 'public',
  defaultBranch: 'main',
  topics: ['nuxt'],
  owner: { login: 'acme', avatarUrl: 'https://a.com/acme.png' },
  stargazersCount: 10,
  forksCount: 2,
  openIssuesCount: 3,
  watchersCount: 4,
  fork: false,
  archived: false,
  isTemplate: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
  pushedAt: '2025-01-03T00:00:00Z',
  license: { key: 'mit', name: 'MIT License', spdxId: 'MIT' },
  subscribersCount: 4,
  networkCount: 2,
  hasWiki: true,
  hasPages: false,
}

const mockStats: RepoHealthStats = {
  stars: 10,
  forks: 2,
  watchers: 4,
  openIssues: 3,
  openPrs: 1,
  lastCommitDate: '2025-01-03T00:00:00Z',
  lastRelease: null,
  license: 'MIT',
  contributorsCount: 1,
  topContributors: [{ login: 'alice', avatarUrl: 'https://a.com/alice.png', contributions: 5 }],
  weeklyCommitActivity: [0, 1, 2],
}

registerEndpoint('/api/repository/acme/demo', {
  method: 'GET',
  handler: () => mockRepoDetail,
})

registerEndpoint('/api/repository/acme/other', {
  method: 'GET',
  handler: () => ({
    ...mockRepoDetail,
    name: 'other',
    fullName: 'acme/other',
    htmlUrl: 'https://github.com/acme/other',
  }),
})

registerEndpoint('/api/repository/acme/demo/stats', {
  method: 'GET',
  handler: () => mockStats,
})

registerEndpoint('/api/repository/acme/other/stats', {
  method: 'GET',
  handler: () => mockStats,
})

registerEndpoint('/api/repository/acme/demo/contents', {
  method: 'GET',
  handler: (event: H3Event) => {
    const url = new URL(event.path, 'http://localhost')
    const path = url.searchParams.get('path') ?? ''

    if (!path) {
      return {
        type: 'directory',
        entries: [
          { name: 'README.md', path: 'README.md', type: 'file', size: 100 },
          { name: 'LICENSE', path: 'LICENSE', type: 'file', size: 50 },
          { name: 'src', path: 'src', type: 'dir', size: 0 },
        ],
      }
    }

    if (path === 'README.md') {
      return {
        type: 'file',
        file: {
          name: 'README.md',
          path: 'README.md',
          content: '# Demo',
          size: 7,
        },
      }
    }

    if (path === 'src') {
      return {
        type: 'directory',
        entries: [
          { name: 'index.ts', path: 'src/index.ts', type: 'file', size: 20 },
        ],
      }
    }

    if (path === 'src/index.ts') {
      return {
        type: 'file',
        file: {
          name: 'index.ts',
          path: 'src/index.ts',
          content: 'console.log("demo")',
          size: 19,
        },
      }
    }

    return {
      type: 'directory',
      entries: [],
    }
  },
})

registerEndpoint('/api/repository/acme/other/contents', {
  method: 'GET',
  handler: (event: H3Event) => {
    const url = new URL(event.path, 'http://localhost')
    const path = url.searchParams.get('path') ?? ''

    if (!path) {
      return {
        type: 'directory',
        entries: [
          { name: 'README.md', path: 'README.md', type: 'file', size: 120 },
          { name: 'SECURITY.md', path: 'SECURITY.md', type: 'file', size: 60 },
        ],
      }
    }

    if (path === 'README.md') {
      return {
        type: 'file',
        file: {
          name: 'README.md',
          path: 'README.md',
          content: '# Other Repo',
          size: 12,
        },
      }
    }

    if (path === 'SECURITY.md') {
      return {
        type: 'file',
        file: {
          name: 'SECURITY.md',
          path: 'SECURITY.md',
          content: 'Security policy',
          size: 15,
        },
      }
    }

    return {
      type: 'directory',
      entries: [],
    }
  },
})

type RepoDetailReturn = ReturnType<typeof useRepoDetail>

async function withRepoDetail<T>(
  fn: (detail: RepoDetailReturn, ctx: { router: ReturnType<typeof useRouter> }) => T | Promise<T>,
  options?: { path?: string },
): Promise<T> {
  let result: T

  const Wrapper = defineComponent({
    async setup() {
      clearNuxtData()
      const route = useRoute()
      const router = useRouter()

      if (options?.path !== undefined) {
        await router.replace({ query: { ...route.query, path: options.path } })
      }
      else if (route.query.path !== undefined) {
        await router.replace({ query: { ...route.query, path: undefined } })
      }

      const owner = ref('acme')
      const repo = ref('demo')
      const detail = useRepoDetail(owner, repo)
      await detail.loadAll()
      await nextTick()

      result = await fn(detail, { router })
      return () => h('div')
    },
  })

  await mountSuspended(Wrapper)
  return result!
}

describe('useRepoDetail', () => {
  it('loadAll initializes README tab and loads README content', async () => {
    await withRepoDetail(async (detail) => {
      await nextTick()
      expect(detail.loading.value).toBe(false)
      expect(detail.error.value).toBeNull()
      expect(detail.repoDetail.value?.fullName).toBe('acme/demo')
      expect(detail.activeTab.value).toBe('README.md')
      expect(detail.specialFiles.value.map(file => file.name)).toEqual(['README.md', 'LICENSE'])
      expect(detail.isCodeTab.value).toBe(false)
      expect(detail.isViewingFile.value).toBe(false)
    })
  })

  it('query path initializes code tab and file mode', async () => {
    await withRepoDetail(async (detail) => {
      await nextTick()
      expect(detail.activeTab.value).toBe('__code__')
      expect(detail.currentPath.value).toBe('src/index.ts')
      expect(detail.browsingFile.value).toBe(true)
      expect(detail.fileContent.value?.path).toBe('src/index.ts')
      expect(detail.isViewingFile.value).toBe(true)
    }, { path: 'src/index.ts' })
  })

  it('navigateToPath switches to code tab and updates route query', async () => {
    await withRepoDetail(async (detail, { router }) => {
      const replaceSpy = vi.spyOn(router, 'replace')
      await detail.navigateToPath('src')
      expect(detail.activeTab.value).toBe('__code__')
      expect(detail.currentPath.value).toBe('src')
      expect(detail.browsingFile.value).toBe(false)
      expect(replaceSpy).toHaveBeenCalledWith({ query: { path: 'src' } })
    })
  })

  it('navigateUp and exitCodeBrowser update query and active tab', async () => {
    await withRepoDetail(async (detail, { router }) => {
      const replaceSpy = vi.spyOn(router, 'replace')
      await detail.navigateToPath('src/index.ts')
      expect(replaceSpy).toHaveBeenCalledWith({ query: { path: 'src/index.ts' } })

      await detail.navigateUp()
      expect(detail.currentPath.value).toBe('src')
      expect(replaceSpy).toHaveBeenCalledWith({ query: { path: 'src' } })

      detail.exitCodeBrowser()
      await nextTick()
      expect(detail.activeTab.value).toBe('README.md')
      expect(replaceSpy).toHaveBeenCalledWith({ query: { path: undefined } })
    })
  })

  it('reloads data when owner/repo refs change', async () => {
    const Wrapper = defineComponent({
      async setup() {
        clearNuxtData()
        const owner = ref('acme')
        const repo = ref('demo')
        const detail = useRepoDetail(owner, repo)

        await detail.loadAll()
        expect(detail.repoDetail.value?.fullName).toBe('acme/demo')

        repo.value = 'other'

        for (let i = 0; i < 20 && detail.repoDetail.value?.fullName !== 'acme/other'; i++) {
          await nextTick()
          await new Promise(resolve => setTimeout(resolve, 0))
        }

        expect(detail.repoDetail.value?.fullName).toBe('acme/other')
        expect(detail.specialFiles.value.map(file => file.name)).toEqual(['README.md', 'SECURITY.md'])

        return () => h('div')
      },
    })

    await mountSuspended(Wrapper)
  })
})
