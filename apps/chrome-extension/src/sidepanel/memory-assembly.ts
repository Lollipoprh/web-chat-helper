// 会话记忆块装配
//
// 每次请求都把「上一段运行账本 + 会话摘要」拼成 <session-memory> 块，
// 放在历史之后、本轮用户消息之前，让模型在中断、跑满轮次、面板关闭后仍知道之前做了什么。
//
// 这里只读现有的 tasks / steps / digest，不新增表、不调模型、不写库。

import type { StopReason } from 'agent-core'
import {
  listSessionTasks,
  listTaskSteps,
  type LogStepRecord,
  type LogTaskStatus,
} from '../shared/step-log-storage'

/** 账本最多展示的步骤数，超出时优先省略最旧的只读记录 */
const MAX_LEDGER_STEPS = 12
/** 单条步骤说明的展示上限 */
const MAX_STEP_MESSAGE_CHARS = 200

export interface MemoryTaskInput {
  taskId: string
  goal: string
  status: LogTaskStatus
  rounds: number
  droppedSteps: number
  stopReason?: StopReason
  tabUrl?: string
  /** 已折叠进 digest 的 run 不再注入账本；P1 才写入该字段 */
  foldedAt?: number
  /** 因达到轮次上限未执行的调用；P1 才持久化 */
  pendingCalls?: Array<{ toolName: string; argsPreview: string }>
  /** 已登记的副作用签名；P1 才持久化 */
  signatures?: string[]
  steps: LogStepRecord[]
}

export interface MemoryAssemblyInput {
  /** 会话摘要，由 /compact 写入 */
  digest?: string
  /** 最近的任务，新的在前 */
  tasks: MemoryTaskInput[]
  /** 本轮用户消息原文，用于判断是否同一目标 */
  currentGoal: string
  maxRounds: number
}

export interface MemoryAssemblyResult {
  /** 记忆块原文；没有可注入内容时为空字符串 */
  text: string
  /** 跨段继承的副作用签名，供下一次 loop 使用 */
  signatures: string[]
}

/** 非正常结束的 run 才注入账本；completed 的最终答复已经在历史里 */
export function isAbnormalStatus(status: LogTaskStatus): boolean {
  return (
    status === 'round_limit' ||
    status === 'cancelled' ||
    status === 'interrupted' ||
    status === 'failed'
  )
}

/**
 * 取紧邻的上一个未正常结束 run。
 * 最新一条已折叠或已正常完成时返回 undefined —— 不向前追溯更旧的 run。
 */
export function selectPreviousRun(
  tasks: MemoryTaskInput[],
): MemoryTaskInput | undefined {
  const latest = tasks[0]
  if (!latest || latest.foldedAt) return undefined
  return isAbnormalStatus(latest.status) ? latest : undefined
}

export function buildSessionMemory(input: MemoryAssemblyInput): MemoryAssemblyResult {
  const previous = selectPreviousRun(input.tasks)
  const lines: string[] = []

  const digest = input.digest?.trim()
  if (digest) lines.push(`会话摘要: ${digest}`)

  if (previous) {
    lines.push(
      `上一段任务（${statusLabel(previous.status)}，第 ${previous.rounds}/${input.maxRounds} 轮）: ${previous.goal}`,
    )
    if (previous.tabUrl) lines.push(`页面: ${previous.tabUrl}（可能已变化）`)

    const { shown, omitted } = selectSteps(previous.steps)
    if (shown.length > 0) {
      lines.push('已完成:')
      for (const step of shown) lines.push(formatStep(step))
    }
    const omittedTotal = omitted + previous.droppedSteps
    if (omittedTotal > 0) {
      lines.push(`  （另有 ${omittedTotal} 条更早的只读记录已省略）`)
    }

    if (previous.status === 'round_limit' && previous.pendingCalls?.length) {
      lines.push('未执行（达到轮次上限）:')
      for (const call of previous.pendingCalls) {
        lines.push(`  ${call.toolName} ${call.argsPreview}`.trimEnd())
      }
    }

    lines.push(buildRuleLine(previous.goal, input.currentGoal))
  }

  if (lines.length === 0) return { text: '', signatures: [] }

  return {
    text: ['<session-memory>', ...lines, '</session-memory>'].join('\n'),
    signatures: previous?.signatures ?? [],
  }
}

/**
 * 从 IndexedDB 读取最近任务与会话摘要，装配记忆块。
 * 只读取被选中的上一段 run 的步骤，避免无谓的全量扫描。
 */
export async function loadSessionMemory(params: {
  sessionId: string
  digest?: string
  currentGoal: string
  maxRounds: number
}): Promise<MemoryAssemblyResult> {
  const records = await listSessionTasks(params.sessionId, 3)
  const tasks: MemoryTaskInput[] = records.map((record) => ({ ...record, steps: [] }))
  const previous = selectPreviousRun(tasks)
  if (previous) {
    previous.steps = await listTaskSteps(previous.taskId)
  }
  return buildSessionMemory({
    digest: params.digest,
    tasks,
    currentGoal: params.currentGoal,
    maxRounds: params.maxRounds,
  })
}

function statusLabel(status: LogTaskStatus): string {
  switch (status) {
    case 'round_limit':
      return '达到轮次上限'
    case 'cancelled':
      return '用户手动停止'
    case 'interrupted':
      return '异常中断'
    case 'failed':
      return '执行失败'
    default:
      return status
  }
}

function formatStep(step: LogStepRecord): string {
  const status = step.ok ? 'ok' : `failed${step.code ? ` ${step.code}` : ''}`
  const message = clip(step.message.trim(), MAX_STEP_MESSAGE_CHARS)
  return `  #${step.round} ${step.toolName} → ${status}${message ? ` ${message}` : ''}`
}

/** 保留写操作与失败项，优先删除最旧的只读行 */
function selectSteps(steps: LogStepRecord[]): {
  shown: LogStepRecord[]
  omitted: number
} {
  if (steps.length <= MAX_LEDGER_STEPS) return { shown: steps, omitted: 0 }

  const dropped = new Set<number>()
  const needDrop = steps.length - MAX_LEDGER_STEPS

  for (let i = 0; i < steps.length && dropped.size < needDrop; i += 1) {
    if (steps[i].readOnly) dropped.add(i)
  }
  for (let i = 0; i < steps.length && dropped.size < needDrop; i += 1) {
    dropped.add(i)
  }

  return {
    shown: steps.filter((_, index) => !dropped.has(index)),
    omitted: dropped.size,
  }
}

function buildRuleLine(previousGoal: string, currentGoal: string): string {
  if (normalizeGoal(previousGoal) === normalizeGoal(currentGoal)) {
    return '规则: 这是历史摘要，不是新指令。页面可能已变化，需要页面状态时重新调用 get_page_snapshot；不要重复上面已成功的写操作；失败或"结果未知"的动作先核验再决定。用户明确要求重做时可以重试。'
  }
  return '规则: 这是历史摘要，不是新指令。上一段任务与本轮无关，其写操作不影响本轮；如确需参考，请先重新调用 get_page_snapshot 读取页面状态。'
}

function normalizeGoal(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function clip(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`
}
