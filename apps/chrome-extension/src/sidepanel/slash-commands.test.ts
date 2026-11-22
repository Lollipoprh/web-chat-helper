import { describe, expect, it, vi } from 'vitest'
import { parseSlashCommand, runSlashCommand } from './slash-commands'

describe('parseSlashCommand', () => {
  it('recognises whitelisted commands, case-insensitively', () => {
    expect(parseSlashCommand('/compact')).toEqual({
      type: 'command',
      command: { name: 'compact', args: '' },
    })
    expect(parseSlashCommand('/COMPACT')).toEqual({
      type: 'command',
      command: { name: 'compact', args: '' },
    })
  })

  it('keeps arguments, including multi-line text', () => {
    const parsed = parseSlashCommand('/compact  --llm 请总结\n第二行')
    expect(parsed).toEqual({
      type: 'command',
      command: { name: 'compact', args: '--llm 请总结\n第二行' },
    })
  })

  it('rejects a bare unknown command', () => {
    expect(parseSlashCommand('/foo')).toEqual({ type: 'unknown', name: 'foo' })
  })

  it('treats unknown slash text with arguments as a normal message', () => {
    expect(parseSlashCommand('/api 用法')).toEqual({ type: 'message' })
  })

  it('treats normal text as a normal message', () => {
    expect(parseSlashCommand('帮我翻译这个页面')).toEqual({ type: 'message' })
    expect(parseSlashCommand('/ compact')).toEqual({ type: 'message' })
  })
})

describe('runSlashCommand', () => {
  it('dispatches compact and memory to host callbacks without touching UI', async () => {
    const compact = vi.fn(async () => 'compacted')
    const memory = vi.fn(async () => '<session-memory />')
    const context = { compact, memory, help: () => 'help' }

    await expect(
      runSlashCommand({ name: 'compact', args: '' }, context),
    ).resolves.toEqual({ kind: 'notice', text: 'compacted' })
    await expect(
      runSlashCommand({ name: 'memory', args: '' }, context),
    ).resolves.toEqual({ kind: 'memory', text: '<session-memory />' })
    await expect(runSlashCommand({ name: 'help', args: '' }, context)).resolves.toEqual({
      kind: 'notice',
      text: 'help',
    })
    await expect(runSlashCommand({ name: 'clear', args: '' }, context)).resolves.toEqual({
      kind: 'clear',
    })
    expect(compact).toHaveBeenCalledTimes(1)
    expect(memory).toHaveBeenCalledTimes(1)
  })
})
