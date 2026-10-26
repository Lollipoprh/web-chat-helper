// OpenAI 兼容 Chat Completions 客户端
// 支持非流式与 SSE 流式、多轮消息、Tool Calls、超时与可取消请求
// 不硬编码任何厂商地址或模型名，全部由调用方传入

import { LLMError, extractServerMessage, httpStatusToLLMError } from './errors'
import { consumeSseStream } from './sse'

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    /** JSON 字符串，可能被模型写坏，执行前必须校验 */
    arguments: string
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    /** JSON Schema 子集，由工具提供方定义 */
    parameters: Record<string, unknown>
  }
}

export interface ChatMessage {
  role: ChatRole
  /** assistant 只调用工具时可以为 null */
  content: string | null
  /** assistant 消息中的工具调用 */
  tool_calls?: ToolCall[]
  /** role=tool 时对应的调用 id */
  tool_call_id?: string
}

export interface ChatRequest {
  /** 归一化后的完整 Chat Completions 地址 */
  chatCompletionsUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  /** 提供的工具；为空则不参与请求体，兼容不支持工具的服务 */
  tools?: ToolDefinition[]
  /** 默认 auto */
  toolChoice?: 'auto' | 'none'
  /** 外部取消信号（用户点击停止） */
  signal?: AbortSignal
  /** 整体超时，默认 120 秒 */
  timeoutMs?: number
}

export interface ChatResult {
  content: string
  finishReason: string | null
  /** 完整消息，可直接追加到对话历史 */
  message: ChatMessage
  toolCalls: ToolCall[]
}

const DEFAULT_CHAT_TIMEOUT_MS = 120_000

export async function createChatCompletion(request: ChatRequest): Promise<ChatResult> {
  const context = createRequestContext(request)

  try {
    const response = await fetch(request.chatCompletionsUrl, {
      method: 'POST',
      headers: buildHeaders(request.apiKey),
      body: JSON.stringify(buildRequestBody(request, false)),
      signal: context.signal,
    })

    const bodyText = await response.text()

    if (!response.ok) {
      throw httpStatusToLLMError(response.status, extractServerMessage(bodyText))
    }

    let payload: unknown
    try {
      payload = JSON.parse(bodyText)
    } catch {
      throw new LLMError('protocol', '接口返回的不是 JSON，可能不是 Chat Completions 兼容服务')
    }

    const choice = getFirstChoice(payload)
    const content = getChoiceMessageContent(choice) ?? ''
    const toolCalls = normalizeToolCalls(getChoiceMessageToolCalls(choice))

    if (!content && toolCalls.length === 0) {
      throw new LLMError('protocol', '返回结构缺少 message.content')
    }

    return {
      content,
      finishReason: getFinishReason(choice),
      message: {
        role: 'assistant',
        content: content || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      toolCalls,
    }
  } catch (error) {
    throw normalizeError(error, context)
  } finally {
    context.cleanup()
  }
}

/**
 * 流式对话。每次收到文本增量时调用 onDelta，返回累计结果。
 * tool_calls 是按下标分片的增量：id / name / arguments 会散落在多个事件里，
 * 因此这里按 index 建缓冲，全部事件结束后才组装成完整调用。
 */
export async function streamChatCompletion(
  request: ChatRequest,
  onDelta: (delta: string) => void,
): Promise<ChatResult> {
  const context = createRequestContext(request)

  try {
    const response = await fetch(request.chatCompletionsUrl, {
      method: 'POST',
      headers: buildHeaders(request.apiKey),
      body: JSON.stringify(buildRequestBody(request, true)),
      signal: context.signal,
    })

    if (!response.ok) {
      const bodyText = await response.text()
      throw httpStatusToLLMError(response.status, extractServerMessage(bodyText))
    }

    if (!response.body) {
      throw new LLMError('protocol', '流式响应缺少 body，请尝试关闭流式输出')
    }

    let content = ''
    let finishReason: string | null = null
    let malformedEvents = 0
    const toolCallBuffers = new Map<number, ToolCallBuffer>()

    await consumeSseStream(response.body, (data) => {
      const trimmed = data.trim()
      if (!trimmed) return
      if (trimmed === '[DONE]') return

      let chunk: unknown
      try {
        chunk = JSON.parse(trimmed)
      } catch {
        malformedEvents += 1
        return
      }

      const choice = getFirstChoice(chunk)
      if (!choice) return

      const delta = getChoiceDeltaContent(choice)
      if (delta) {
        content += delta
        onDelta(delta)
      }

      accumulateToolCallDeltas(toolCallBuffers, getChoiceDeltaToolCalls(choice))

      const reason = getFinishReason(choice)
      if (reason) finishReason = reason
    })

    const toolCalls = buildToolCallsFromBuffers(toolCallBuffers)

    // 一条内容都没解析出来却有非法事件，说明对方不是兼容的流式实现
    if (!content && toolCalls.length === 0 && malformedEvents > 0) {
      throw new LLMError('protocol', '流式响应格式不兼容，请在设置中关闭流式输出后重试')
    }

    return {
      content,
      finishReason,
      message: {
        role: 'assistant',
        content: content || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      toolCalls,
    }
  } catch (error) {
    throw normalizeError(error, context)
  } finally {
    context.cleanup()
  }
}

function buildRequestBody(request: ChatRequest, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
    stream,
  }

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools
    body.tool_choice = request.toolChoice ?? 'auto'
  }

  return body
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

interface RequestContext {
  signal: AbortSignal
  timedOut: () => boolean
  cleanup: () => void
}

function createRequestContext(request: ChatRequest): RequestContext {
  if (request.signal?.aborted) {
    throw new LLMError('aborted', '请求已取消')
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS
  const controller = new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const onExternalAbort = () => controller.abort()
  request.signal?.addEventListener('abort', onExternalAbort, { once: true })

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer)
      request.signal?.removeEventListener('abort', onExternalAbort)
    },
  }
}

function normalizeError(error: unknown, context: RequestContext): LLMError {
  if (error instanceof LLMError) return error

  if (context.timedOut()) {
    return new LLMError('timeout', '请求超时，请检查网络或缩短对话长度后重试')
  }
  if (context.signal.aborted) {
    return new LLMError('aborted', '请求已取消')
  }
  if (error instanceof TypeError) {
    // fetch 在缺少站点权限、网络不可达或 CORS 失败时抛 TypeError
    return new LLMError('network', `无法连接模型服务：${error.message}`)
  }

  return new LLMError('network', error instanceof Error ? error.message : String(error))
}

interface NormalizedChoice {
  message?: { content?: unknown; tool_calls?: unknown }
  delta?: { content?: unknown; tool_calls?: unknown }
  finish_reason?: unknown
}

function getFirstChoice(payload: unknown): NormalizedChoice | null {
  if (!payload || typeof payload !== 'object') return null
  const choices = (payload as Record<string, unknown>).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (!first || typeof first !== 'object') return null
  return first as NormalizedChoice
}

function getChoiceMessageContent(choice: NormalizedChoice | null): string | null {
  const content = choice?.message?.content
  return typeof content === 'string' ? content : null
}

function getChoiceMessageToolCalls(choice: NormalizedChoice | null): unknown {
  return choice?.message?.tool_calls
}

function getChoiceDeltaContent(choice: NormalizedChoice): string {
  const content = choice.delta?.content
  return typeof content === 'string' ? content : ''
}

function getChoiceDeltaToolCalls(choice: NormalizedChoice): unknown {
  return choice.delta?.tool_calls
}

function getFinishReason(choice: NormalizedChoice | null): string | null {
  const reason = choice?.finish_reason
  return typeof reason === 'string' && reason ? reason : null
}

/** 解析非流式返回中的完整 tool_calls */
function normalizeToolCalls(raw: unknown): ToolCall[] {
  if (!Array.isArray(raw)) return []

  const calls: ToolCall[] = []
  raw.forEach((entry, index) => {
    const call = normalizeToolCallEntry(entry, index)
    if (call) calls.push(call)
  })
  return calls
}

function normalizeToolCallEntry(entry: unknown, index: number, fallbackId?: string): ToolCall | null {
  if (!entry || typeof entry !== 'object') return null
  const item = entry as Record<string, unknown>
  const fn = item.function
  if (!fn || typeof fn !== 'object') return null

  const fnRecord = fn as Record<string, unknown>
  if (typeof fnRecord.name !== 'string' || !fnRecord.name) return null

  return {
    id: typeof item.id === 'string' && item.id ? item.id : (fallbackId ?? `call_${index}`),
    type: 'function',
    function: {
      name: fnRecord.name,
      arguments: typeof fnRecord.arguments === 'string' ? fnRecord.arguments : '',
    },
  }
}

interface ToolCallBuffer {
  id?: string
  name?: string
  arguments: string
}

/** 流式增量：按下标累积 id / name / arguments，arguments 逐字符拼接 */
function accumulateToolCallDeltas(
  buffers: Map<number, ToolCallBuffer>,
  raw: unknown,
): void {
  if (!Array.isArray(raw)) return

  raw.forEach((entry, arrayIndex) => {
    if (!entry || typeof entry !== 'object') return
    const item = entry as Record<string, unknown>

    const index =
      typeof item.index === 'number' && Number.isInteger(item.index) ? item.index : arrayIndex

    const buffer = buffers.get(index) ?? { arguments: '' }
    const fn = item.function
    if (fn && typeof fn === 'object') {
      const fnRecord = fn as Record<string, unknown>
      // name 通常只出现一次，取最后一个非空值，避免重复拼接
      if (typeof fnRecord.name === 'string' && fnRecord.name) {
        buffer.name = fnRecord.name
      }
      if (typeof fnRecord.arguments === 'string') {
        buffer.arguments += fnRecord.arguments
      }
    }
    if (typeof item.id === 'string' && item.id) {
      buffer.id = item.id
    }

    buffers.set(index, buffer)
  })
}

function buildToolCallsFromBuffers(buffers: Map<number, ToolCallBuffer>): ToolCall[] {
  return [...buffers.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, buffer]) => {
      if (!buffer.name) return null
      const call: ToolCall = {
        id: buffer.id ?? `call_${index}`,
        type: 'function',
        function: { name: buffer.name, arguments: buffer.arguments },
      }
      return call
    })
    .filter((call): call is ToolCall => call !== null)
}
