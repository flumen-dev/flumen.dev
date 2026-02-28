import { describe, expect, it } from 'vitest'
import { buildWorkItemPath } from '../../app/utils/workItemPath'

describe('buildWorkItemPath', () => {
  it('builds issue and pull work item paths for valid owner/repo', () => {
    expect(buildWorkItemPath('flumen-dev/flumen.dev', 7)).toBe('/repos/flumen-dev/flumen.dev/work-items/7')
    expect(buildWorkItemPath('flumen-dev/flumen.dev', 12, 'pr')).toBe('/repos/flumen-dev/flumen.dev/work-items/pr-12')
    expect(buildWorkItemPath('flumen-dev/flumen.dev', 19, 'pull')).toBe('/repos/flumen-dev/flumen.dev/work-items/pr-19')
    expect(buildWorkItemPath('flumen-dev/flumen.dev', 'pr-123', 'pr')).toBe('/repos/flumen-dev/flumen.dev/work-items/pr-123')
  })

  it('returns null when owner or repo segment is missing', () => {
    expect(buildWorkItemPath('owneronly', 1)).toBeNull()
    expect(buildWorkItemPath('/repo', 1)).toBeNull()
    expect(buildWorkItemPath('owner/', 1)).toBeNull()
  })

  it('returns null when repoFullName has extra slash segments', () => {
    expect(buildWorkItemPath('a/b/c', 1)).toBeNull()
    expect(buildWorkItemPath('a/b/c/d', 1)).toBeNull()
  })
})
