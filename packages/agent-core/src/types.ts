// Agent 核心类型：工具接口、统一结果、日志与停止原因

import type { ChatMessage } from 'llm-client'
import type { JsonSchema } from './validation'

export type ToolErrorCode =
  | 'unknown_tool'
  | 'invalid_json'
  | 'invalid_args'
  | 'duplicate_call'
  | 'timeout'
  | 'cancelled'
  | 'not_authorized'
  | 'unsupported_page'
  | 'element_not_found'
  | 'stale_element'
  | 'execution_failed'
  | 'needs_confirmation'

/** 统一工具结果：既回传给模型，也用于界面展示 */
export interface ToolResult {
  ok: boolean
  code?: ToolErrorCode
  /** 结构化数据，回传给模型 */
  data?: unknown
  /** 简短的人类可读说明，两名模型与用户共用 */
  message: string
}

export interface AgentToolContext {
  /** 取消信号，工具内部的长等待应尊重它 */
  signal: AbortSignal
  taskId: string
  round: number
  /** 目标标签页；浏览器工具使用，非浏览器工具忽略 */
  tabId?: number
}

export interface AgentTool {
  name: string
  description: string
  parameters: JsonSchema
  /** 只读工具：相同参数的重复调用不会被拦截（轮次上限仍然生效） */
  readOnly?: boolean
  /** 有副作用的动作（发送、提交、删除）需在阶段 6 接入用户确认 */
  requiresConfirmation?: boolean
  execute(args: Record<string, unknown>, context: AgentToolContext): Promise<ToolResult>
}

export type StopReason = 'completed' | 'round_limit' | 'cancelled' | 'error'

/** 工具调用过程事件，驱动界面上的调用卡片 */
export interface AgentToolEvent {
  /** 对应 tool_call id */
  id: string
  round: number
  name: string
  /** 脱敏并截断后的参数预览 */
  argsPreview: string
  status: 'running' | 'awaiting_confirmation' | 'success' | 'error'
  durationMs?: number
  summary?: string
  errorCode?: ToolErrorCode
}

/** loop 向宿主请求用户确认；宿主返回 true=执行，false=拒绝 */
export interface ConfirmationRequest {
  toolName: string
  args: Record<string, unknown>
  argsPreview: string
  /** 目标标签页提示，宿主可展示给用户 */
  tabId?: number
  signal?: AbortSignal
}

/** 未完成任务的检查点：Side Panel 关闭或扩展重启后用于标记"已中断" */
export interface AgentCheckpoint {
  taskId: string
  /** 本轮助手已产生的消息（含 tool_calls 与 tool role 消息） */
  messages: ChatMessage[]
  /** 已完成的轮次 */
  rounds: number
  /** 最近一次记录时间 */
  updatedAt: number
}

/** 每轮工具调用的结构化日志（阶段 6 会持久化为检查点） */
export interface AgentToolLog {
  taskId: string
  round: number
  toolName: string
  /** 已脱敏的参数 */
  argsRedacted: string
  ok: boolean
  code?: ToolErrorCode
  message: string
  tabId?: number
  durationMs: number
}

export interface AgentRunResult {
  stopReason: StopReason
  rounds: number
  /** 最后一轮助手文本，用于界面展示 */
  finalText: string
  /** stopReason 为 error 时的原因 */
  error?: string
  logs: AgentToolLog[]
  messages: ChatMessage[]
}
