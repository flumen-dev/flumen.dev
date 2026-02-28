import { describe, expect, it } from 'vitest'
import { parseActionsLog } from '../../app/utils/ciLogParser'

describe('parseActionsLog', () => {
  it('parses grouped sections', () => {
    const log = [
      '##[group]Run actions/checkout@v4',
      'Syncing repository',
      'Done',
      '##[endgroup]',
    ].join('\n')

    const sections = parseActionsLog(log)
    expect(sections).toHaveLength(1)
    expect(sections[0]!.name).toBe('Run actions/checkout@v4')
    expect(sections[0]!.lines).toEqual(['Syncing repository', 'Done'])
    expect(sections[0]!.collapsed).toBe(true)
  })

  it('strips GitHub Actions timestamps', () => {
    const log = [
      '2026-02-28T19:42:22.1234567Z ##[group]Setup',
      '2026-02-28T19:42:22.9876543Z installing deps',
      '2026-02-28T19:42:23.0000000Z ##[endgroup]',
    ].join('\n')

    const sections = parseActionsLog(log)
    expect(sections[0]!.lines).toEqual(['installing deps'])
  })

  it('puts ungrouped lines into default open sections', () => {
    const log = 'line 1\nline 2\nline 3'
    const sections = parseActionsLog(log)

    expect(sections).toHaveLength(1)
    expect(sections[0]!.name).toBe('')
    expect(sections[0]!.collapsed).toBe(false)
    expect(sections[0]!.lines).toEqual(['line 1', 'line 2', 'line 3'])
  })

  it('starts a new default section after a group ends', () => {
    const log = [
      '##[group]Setup',
      'setting up',
      '##[endgroup]',
      'orphan line',
    ].join('\n')

    const sections = parseActionsLog(log)
    expect(sections).toHaveLength(2)
    expect(sections[0]!.name).toBe('Setup')
    expect(sections[1]!.name).toBe('')
    expect(sections[1]!.lines).toEqual(['orphan line'])
  })

  it('skips ##[command] and other directives', () => {
    const log = [
      '##[group]Build',
      '##[command]npm run build',
      'Building...',
      '##[warning]Deprecated API',
      '##[endgroup]',
    ].join('\n')

    const sections = parseActionsLog(log)
    expect(sections[0]!.lines).toEqual(['Building...'])
  })

  it('handles unclosed group at end of log', () => {
    const log = [
      '##[group]Deploy',
      'deploying...',
      'still going',
    ].join('\n')

    const sections = parseActionsLog(log)
    expect(sections).toHaveLength(1)
    expect(sections[0]!.name).toBe('Deploy')
    expect(sections[0]!.lines).toEqual(['deploying...', 'still going'])
  })

  it('filters empty sections', () => {
    const log = '##[group]Empty\n##[endgroup]'
    const sections = parseActionsLog(log)
    // Section has a name but no lines — kept because it has a name
    expect(sections).toHaveLength(1)
    expect(sections[0]!.name).toBe('Empty')
  })

  it('handles consecutive groups', () => {
    const log = [
      '##[group]Step 1',
      'output 1',
      '##[endgroup]',
      '##[group]Step 2',
      'output 2',
      '##[endgroup]',
    ].join('\n')

    const sections = parseActionsLog(log)
    expect(sections).toHaveLength(2)
    expect(sections[0]!.name).toBe('Step 1')
    expect(sections[1]!.name).toBe('Step 2')
  })

  it('returns empty array for empty input', () => {
    expect(parseActionsLog('')).toEqual([])
  })
})
