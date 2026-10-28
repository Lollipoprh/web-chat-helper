// Agent Loop
// 循环：模型请求 → 参数校验 → 工具执行 → 结果回传 → 下一轮，直到模型给出最终答复或触发停止条件
// 硬约束：轮次上限、单次工具超时、重复调用拦截、随时取消；所有调用留结构化日志

import {
  LLMError,
  createChatCompletion,
  streamChatCompletion,
  type ChatMessage,
  type ChatRequest,
  type ChatResult,
  type ToolCall,
} from 'llm-client'
import { ToolRegistry } from './registry'
import { validateToolArguments } from './validation'
import type {
  AgentRunResult,
  AgentTool,
  AgentToolContext,
  AgentToolEvent,
  AgentToolLog,
  ConfirmationRequest,
  StopReason,
  ToolErrorCode,
  ToolResult,
} from './types'

export interface AgentChatConfig {
  chatCompletionsUrl: string
  apiKey: string
  model: string
  supportsStreaming: boolean
  supportsToolCalls: boolean
}

export interface AgentLimits {
  /** 最多几轮模型工具调用 */
  maxRounds: number
  /** 单次工具执行超时 */
  toolTimeoutMs: number
  /** 单次模型请求超时 */
  requestTimeoutMs: number
}

export const DEFAULT_AGENT_LIMITS: AgentLimits = {
  maxRounds: 50,
  toolTimeoutMs: 20_000,
  requestTimeoutMs: 120_000,
}

export interface AgentRunOptions {
  chat: AgentChatConfig
  tools: ToolRegistry
  messages: ChatMessage[]
  limits?: Partial<AgentLimits>
  signal?: AbortSignal
  tabId?: number
  /** 宿主可预先指定任务 ID，便于在任务开始前就关联日志与界面状态 */
  taskId?: string
  onTextDelta?: (delta: string) => void
  onToolEvent?: (event: AgentToolEvent) => void
  onLog?: (log: AgentToolLog) => void
  /**
   * 副作用动作执行前询问宿主是否允许。返回 true=执行，false=拒绝。
   * 回调内的 signal 与外层 signal 共用；abort 时应抛出，让 loop 取消等待。
   */
  onConfirmationRequest?: (request: ConfirmationRequest) => Promise<boolean>
  /** 每轮结束后（模型已返回 + 所有工具已执行）触发，宿主可持久化检查点 */
  onCheckpoint?: (messages: ChatMessage[], rounds: number, taskId: string) => void
}

export async function runAgentLoop(options: AgentRunOptions): Promise<AgentRunResult> {
  const limits: AgentLimits = { ...DEFAULT_AGENT_LIMITS, ...options.limits }
  const taskId = options.taskId ?? crypto.randomUUID()
  const messages: ChatMessage[] = [...options.messages]
  const logs: AgentToolLog[] = []
  const executedSignatures = new Set<string>()

  let rounds = 0
  let finalText = ''

  const finish = (stopReason: StopReason, extra?: { error?: string }): AgentRunResult => ({
    stopReason,
    rounds,
    finalText,
    logs,
    messages,
    ...extra,
  })

  while (rounds < limits.maxRounds) {
    if (options.signal?.aborted) return finish('cancelled')
    rounds += 1

    const request: ChatRequest = {
      chatCompletionsUrl: options.chat.chatCompletionsUrl,
      apiKey: options.chat.apiKey,
      model: options.chat.model,
      messages,
      tools: options.chat.supportsToolCalls ? options.tools.toDefinitions() : undefined,
      toolChoice: 'auto',
      signal: options.signal,
      timeoutMs: limits.requestTimeoutMs,
    }

    let result: ChatResult
    try {
      result = options.chat.supportsStreaming
        ? await streamChatCompletion(request, (delta) => options.onTextDelta?.(delta))
        : await createChatCompletion(request)
    } catch (error) {
      if (options.signal?.aborted || (error instanceof LLMError && error.code === 'aborted')) {
        return finish('cancelled')
      }
      return finish('error', { error: describeError(error) })
    }

    messages.push(result.message)
    if (result.content) finalText = result.content

    // 没有工具调用：模型已给出最终答复
    if (result.toolCalls.length === 0) {
      return finish('completed')
    }

    // 已到最后一轮：工具结果没有机会再交给模型，直接停止并报告原因
    if (rounds >= limits.maxRounds) {
      return finish('round_limit')
    }

    for (const call of result.toolCalls) {
      if (options.signal?.aborted) return finish('cancelled')

      const executed = await executeToolCall({
        call,
        round: rounds,
        taskId,
        tools: options.tools,
        tabId: options.tabId,
        signal: options.signal,
        toolTimeoutMs: limits.toolTimeoutMs,
        executedSignatures,
        onToolEvent: options.onToolEvent,
        onConfirmationRequest: options.onConfirmationRequest,
      })

      logs.push(executed.log)
      options.onLog?.(executed.log)
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(executed.modelPayload),
      })
    }

    // 每轮结束：持久化检查点，供中断恢复使用
    options.onCheckpoint?.(messages, rounds, taskId)
  }

  // 理论上前面的检查已覆盖，这里兜底
  return finish('round_limit')
}

interface ExecuteToolParams {
  call: ToolCall
  round: number
  taskId: string
  tools: ToolRegistry
  tabId?: number
  signal?: AbortSignal
  toolTimeoutMs: number
  executedSignatures: Set<string>
  onToolEvent?: (event: AgentToolEvent) => void
  onConfirmationRequest?: (request: ConfirmationRequest) => Promise<boolean>
}

interface ExecutedToolCall {
  /** 回传给模型的结构化结果 */
  modelPayload: Record<string, unknown>
  log: AgentToolLog
}

async function executeToolCall(params: ExecuteToolParams): Promise<ExecutedToolCall> {
  const { call, round, taskId, toolTimeoutMs, onToolEvent } = params
  const toolName = call.function.name
  const startedAt = Date.now()
  let argsPreview = '(无法解析)'

  const baseLog = (): AgentToolLog => ({
    taskId,
    round,
    toolName,
    argsRedacted: argsPreview,
    ok: false,
    message: '',
    durationMs: Date.now() - startedAt,
  })

  const fail = (code: ToolErrorCode, message: string): ExecutedToolCall => {
    const durationMs = Date.now() - startedAt
    onToolEvent?.({
      id: call.id,
      round,
      name: toolName,
      argsPreview,
      status: 'error',
      durationMs,
      summary: message,
      errorCode: code,
    })
    return {
      modelPayload: { ok: false, code, message },
      log: { ...baseLog(), ok: false, code, message, durationMs },
    }
  }

  // 1. 参数 JSON 解析
  let parsedArgs: Record<string, unknown>
  try {
    const raw = call.function.arguments.trim()
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fail('invalid_json', '工具参数必须是 JSON 对象，调用未执行')
    }
    parsedArgs = parsed as Record<string, unknown>
    argsPreview = previewArgs(parsedArgs)
  } catch {
    return fail('invalid_json', '工具参数不是合法 JSON，调用未执行')
  }

  // 2. 工具存在性
  const tool = params.tools.get(toolName)
  if (!tool) {
    const available = params.tools.names().join('、') || '无'
    return fail('unknown_tool', `未知工具「${toolName}」，可用工具：${available}`)
  }

  // 3. 参数结构校验
  const validation = validateToolArguments(tool.parameters, parsedArgs)
  if (!validation.ok) {
    return fail('invalid_args', `参数不合法：${validation.error}`)
  }

  // 4. 重复调用拦截（同一任务内相同工具 + 相同参数）
  //    只读工具允许重复执行：页面变化后重读快照是正常操作，由轮次上限兜底
  if (!tool.readOnly) {
    const signature = `${tool.name}:${stableStringify(validation.value)}`
    if (params.executedSignatures.has(signature)) {
      return fail('duplicate_call', '与本次任务中已执行过的调用完全相同，已跳过以避免重复副作用')
    }
    params.executedSignatures.add(signature)
  }

  // 5. 副作用动作确认：没有 onConfirmationRequest 时默认允许，保持向后兼容
  if (tool.requiresConfirmation) {
    onToolEvent?.({
      id: call.id,
      round,
      name: toolName,
      argsPreview,
      status: 'awaiting_confirmation',
      summary: '等待用户确认',
    })

    if (params.signal?.aborted) {
      return fail('cancelled', '任务已取消，调用未执行')
    }

    let allowed: boolean
    try {
      allowed = await params.onConfirmationRequest?.({
        toolName,
        args: validation.value,
        argsPreview,
        tabId: params.tabId,
        signal: params.signal,
      }) ?? true
    } catch (error) {
      const aborted =
        params.signal?.aborted ||
        error instanceof ToolCancelledError ||
        (error instanceof DOMException && error.name === 'AbortError')
      if (aborted) {
        return fail('cancelled', '确认阶段被取消')
      }
      return fail('execution_failed', `确认流程异常：${describeError(error)}`)
    }

    if (!allowed) {
      // 拒绝后也把签名加入已执行列表，防止模型反复尝试相同副作用动作
      if (!tool.readOnly) {
        const signature = `${tool.name}:${stableStringify(validation.value)}`
        params.executedSignatures.add(signature)
      }
      return fail(
        'needs_confirmation',
        `用户拒绝执行「${toolName}」。可以调整目标或选择其他动作，但再次请求完全相同的调用会被跳过。`,
      )
    }
  }

  // 6. 执行
  onToolEvent?.({
    id: call.id,
    round,
    name: toolName,
    argsPreview,
    status: 'running',
  })

  if (params.signal?.aborted) {
    return fail('cancelled', '任务已取消，调用未执行')
  }

  let result: ToolResult
  try {
    result = await runToolWithTimeout(
      tool,
      validation.value,
      { taskId, round },
      toolTimeoutMs,
      params.signal,
    )
  } catch (error) {
    if (error instanceof ToolTimeoutError) {
      return fail('timeout', `工具执行超时（超过 ${Math.round(toolTimeoutMs / 1000)} 秒）`)
    }
    if (error instanceof ToolCancelledError) {
      return fail('cancelled', '任务已取消')
    }
    return fail('execution_failed', `工具执行失败：${describeError(error)}`)
  }

  const durationMs = Date.now() - startedAt
  const ok = result.ok
  onToolEvent?.({
    id: call.id,
    round,
    name: toolName,
    argsPreview,
    status: ok ? 'success' : 'error',
    durationMs,
    summary: result.message,
    errorCode: result.code,
  })

  return {
    modelPayload: {
      ok,
      ...(result.code ? { code: result.code } : {}),
      message: result.message,
      ...(result.data !== undefined ? { data: result.data } : {}),
    },
    log: {
      ...baseLog(),
      ok,
      ...(result.code ? { code: result.code } : {}),
      message: result.message,
      durationMs,
    },
  }
}

class ToolTimeoutError extends Error {}
class ToolCancelledError extends Error {}

function runToolWithTimeout(
  tool: AgentTool,
  args: Record<string, unknown>,
  context: Omit<AgentToolContext, 'signal'>,
  timeoutMs: number,
  outerSignal: AbortSignal | undefined,
): Promise<ToolResult> {
  const controller = new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const onOuterAbort = () => controller.abort()
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true })

  return new Promise<ToolResult>((resolve, reject) => {
    const onAbort = () => {
      reject(timedOut ? new ToolTimeoutError() : new ToolCancelledError())
    }
    controller.signal.addEventListener('abort', onAbort, { once: true })

    tool
      .execute(args, { ...context, signal: controller.signal })
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timer)
        outerSignal?.removeEventListener('abort', onOuterAbort)
        controller.signal.removeEventListener('abort', onAbort)
      })
  })
}

const SENSITIVE_KEY_PATTERN = /api[-_]?key|token|secret|password|authorization/i

/** 参数脱敏与截断：敏感字段替换为 ***，长文本截断，避免日志泄漏或爆量 */
export function previewArgs(args: Record<string, unknown>): string {
  const redacted = redactValue(args)
  const text = safeStringify(redacted)
  return text.length > 300 ? `${text.slice(0, 300)}…` : text
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '…'
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 120)}…` : value
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactValue(item, depth + 1))
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '***' : redactValue(child, depth + 1)
    }
    return result
  }
  return value
}

function stableStringify(value: unknown): string {
  return safeStringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return value
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}

function describeError(error: unknown): string {
  if (error instanceof LLMError) return error.message
  return error instanceof Error ? error.message : String(error)
}
