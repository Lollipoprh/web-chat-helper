import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChatCompletion, type ChatResult, type ToolCall } from 'llm-client'
import { previewArgs, runAgentLoop } from './loop'
import { ToolRegistry } from './registry'
import type { AgentTool, ToolResult } from './types'

vi.mock('llm-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('llm-client')>()
  return {
    ...actual,
    createChatCompletion: vi.fn(),
    streamChatCompletion: vi.fn(),
  }
})

const mockedCreate = vi.mocked(createChatCompletion)

const chat = {
  chatCompletionsUrl: 'https://api.example.com/v1/chat/completions',
  apiKey: 'test-key',
  model: 'test-model',
  supportsStreaming: false,
  supportsToolCalls: true,
}

function toolCall(name: string, args: Record<string, unknown>, id = 'call_1'): ToolCall {
  return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } }
}

function resultWith(toolCalls: ToolCall[]): ChatResult {
  const toolResult: ChatResult = {
    content: '',
    finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    message:
      toolCalls.length > 0
        ? { role: 'assistant', content: null, tool_calls: toolCalls }
        : { role: 'assistant', content: 'done' },
    toolCalls,
  }
  if (toolCalls.length === 0) toolResult.content = 'done'
  return toolResult
}

function freeFormTool(execute: AgentTool['execute'], overrides: Partial<AgentTool> = {}): AgentTool {
  return {
    name: 'click_element',
    description: 'click an element',
    parameters: {},
    execute,
    ...overrides,
  }
}

beforeEach(() => {
  mockedCreate.mockReset()
})

describe('runAgentLoop', () => {
  it('skips duplicate side-effecting calls with identical arguments', async () => {
    const execute = vi.fn(async (): Promise<ToolResult> => ({ ok: true, message: 'clicked' }))
    const registry = new ToolRegistry().register(freeFormTool(execute))

    mockedCreate
      .mockResolvedValueOnce(resultWith([toolCall('click_element', { ref: 'ref-1' })]))
      .mockResolvedValueOnce(
        resultWith([toolCall('click_element', { ref: 'ref-1' }, 'call_2')]),
      )
      .mockResolvedValueOnce(resultWith([]))

    const result = await runAgentLoop({ chat, tools: registry, messages: [] })

    expect(result.stopReason).toBe('completed')
    expect(result.rounds).toBe(3)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(result.logs.map((log) => log.code)).toEqual([undefined, 'duplicate_call'])
  })

  it('allows repeated calls to read-only tools', async () => {
    const execute = vi.fn(async (): Promise<ToolResult> => ({ ok: true, message: 'read' }))
    const registry = new ToolRegistry().register(freeFormTool(execute, { readOnly: true }))

    mockedCreate
      .mockResolvedValueOnce(resultWith([toolCall('click_element', { ref: 'ref-1' })]))
      .mockResolvedValueOnce(
        resultWith([toolCall('click_element', { ref: 'ref-1' }, 'call_2')]),
      )
      .mockResolvedValueOnce(resultWith([]))

    await runAgentLoop({ chat, tools: registry, messages: [] })

    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid arguments before executing the tool', async () => {
    const execute = vi.fn(async (): Promise<ToolResult> => ({ ok: true, message: 'clicked' }))
    const registry = new ToolRegistry().register({
      ...freeFormTool(execute),
      parameters: {
        type: 'object',
        properties: { ref: { type: 'string' } },
        required: ['ref'],
        additionalProperties: false,
      },
    })

    mockedCreate
      .mockResolvedValueOnce(resultWith([toolCall('click_element', {})]))
      .mockResolvedValueOnce(resultWith([]))

    const result = await runAgentLoop({ chat, tools: registry, messages: [] })

    expect(execute).not.toHaveBeenCalled()
    expect(result.logs[0].code).toBe('invalid_args')
  })

  it('stops a side-effecting call when the user denies confirmation', async () => {
    const execute = vi.fn(async (): Promise<ToolResult> => ({ ok: true, message: 'clicked' }))
    const registry = new ToolRegistry().register(
      freeFormTool(execute, { requiresConfirmation: true }),
    )
    const events: string[] = []

    mockedCreate
      .mockResolvedValueOnce(resultWith([toolCall('click_element', { ref: 'ref-1' })]))
      .mockResolvedValueOnce(resultWith([]))

    const result = await runAgentLoop({
      chat,
      tools: registry,
      messages: [],
      onToolEvent: (event) => events.push(event.status),
      onConfirmationRequest: async () => false,
    })

    expect(execute).not.toHaveBeenCalled()
    expect(result.logs[0].code).toBe('needs_confirmation')
    expect(events).toContain('awaiting_confirmation')
  })

  it('returns cancelled without calling the model when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const registry = new ToolRegistry().register(freeFormTool(async () => ({ ok: true, message: 'x' })))

    const result = await runAgentLoop({
      chat,
      tools: registry,
      messages: [],
      signal: controller.signal,
    })

    expect(result.stopReason).toBe('cancelled')
    expect(result.rounds).toBe(0)
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('stops at the round limit and does not execute the last round tools', async () => {
    const execute = vi.fn(async (): Promise<ToolResult> => ({ ok: true, message: 'clicked' }))
    const registry = new ToolRegistry().register(freeFormTool(execute))

    mockedCreate
      .mockResolvedValueOnce(resultWith([toolCall('click_element', { ref: 'ref-1' })]))
      .mockResolvedValueOnce(resultWith([toolCall('click_element', { ref: 'ref-2' })]))

    const result = await runAgentLoop({
      chat,
      tools: registry,
      messages: [],
      limits: { maxRounds: 2 },
    })

    expect(result.stopReason).toBe('round_limit')
    expect(result.rounds).toBe(2)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('times out a tool that never settles', async () => {
    const registry = new ToolRegistry().register(
      freeFormTool(() => new Promise<ToolResult>(() => {})),
    )

    mockedCreate
      .mockResolvedValueOnce(resultWith([toolCall('click_element', { ref: 'ref-1' })]))
      .mockResolvedValueOnce(resultWith([]))

    const result = await runAgentLoop({
      chat,
      tools: registry,
      messages: [],
      limits: { toolTimeoutMs: 10 },
    })

    expect(result.logs[0].code).toBe('timeout')
    expect(result.stopReason).toBe('completed')
  })
})

describe('previewArgs', () => {
  it('redacts sensitive keys and truncates long values', () => {
    const preview = previewArgs({
      apiKey: 'secret-value',
      nested: { token: 'token-value' },
      text: 'a'.repeat(200),
    })

    expect(preview).not.toContain('secret-value')
    expect(preview).not.toContain('token-value')
    expect(preview).toContain('***')
    expect(preview).toContain('…')
  })
})
