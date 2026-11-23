// 运行块：把「一次任务的 N 次工具调用」折叠成一行摘要，展开后是步骤时间线。
//
// 数据有两个来源：
// 1. 正在跑的任务 —— 内存里的 toolEvents，带 running / awaiting_confirmation 状态；
// 2. 已经结束的任务 —— 任务日志里的 steps，按 taskId 懒加载。
// 两者都归一成 AgentToolEvent，复用同一个步骤行组件，避免两套渲染。

import { useEffect, useRef, useState } from 'react'
import type { AgentToolEvent } from 'agent-core'
import { listTaskSteps, type LogTaskRecord, type LogStepRecord } from '../../shared/step-log-storage'
import { useI18n } from '../../shared/useI18n'
import type { MessageKey } from '../../shared/i18n'
import { Icon, IconButton, LoadingRow, color, fontSize, radius, space } from '../../ui'
import { ToolEventItem } from './ToolEventItem'

export interface RunBlockProps {
  /** 这次运行的任务 id；旧消息没有该字段，只展示内存事件 */
  taskId?: string
  /** 任务摘要（步数、耗时、状态），由会话任务列表缓存提供 */
  task?: LogTaskRecord
  /** 运行中的实时事件 */
  events?: AgentToolEvent[]
  /** 该条回复是否仍在流式生成 */
  streaming: boolean
  /** 提供时显示「重新生成」按钮（调用方负责判断能否安全重跑） */
  onRetry?: () => void
}

const TASK_STATUS_META: Record<
  LogTaskRecord['status'],
  { labelKey: MessageKey; tone: string }
> = {
  running: { labelKey: 'tool.running', tone: color.textMuted },
  completed: { labelKey: 'tool.success', tone: color.success },
  failed: { labelKey: 'tool.error', tone: color.danger },
  cancelled: { labelKey: 'tool.error', tone: color.textFaint },
  interrupted: { labelKey: 'task.statusInterrupted', tone: color.warningText },
  round_limit: { labelKey: 'task.statusRoundLimit', tone: color.warningText },
}

export function RunBlock({
  taskId,
  task,
  events,
  streaming,
  onRetry,
}: RunBlockProps) {
  const { t } = useI18n()
  // 用户手动点过的优先级高于默认值：运行中默认展开，结束后默认收起
  const [toggled, setToggled] = useState<boolean | null>(null)
  const [loadedSteps, setLoadedSteps] = useState<LogStepRecord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const requestRef = useRef(0)

  const open = toggled ?? streaming
  const liveSteps = events ?? null
  const stepCount = liveSteps?.length ?? task?.stepCount ?? loadedSteps?.length ?? 0

  // 展开且没有实时事件时，按 taskId 读一次落盘步骤
  useEffect(() => {
    if (!open || liveSteps || !taskId || loadedSteps) return
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    void listTaskSteps(taskId)
      .then((steps) => {
        if (requestRef.current === requestId) setLoadedSteps(steps)
      })
      .catch((error: unknown) => {
        console.warn('[run] 读取步骤失败', error)
        if (requestRef.current === requestId) setLoadedSteps([])
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false)
      })
  }, [open, liveSteps, taskId, loadedSteps])

  if (!taskId && stepCount === 0 && !streaming) return null

  const steps: AgentToolEvent[] = liveSteps
    ? liveSteps
    : (loadedSteps ?? []).map((step) => stepToEvent(step))

  const statusMeta = task
    ? TASK_STATUS_META[task.status]
    : streaming
      ? TASK_STATUS_META.running
      : TASK_STATUS_META.completed

  const durationMs =
    task && task.updatedAt > task.createdAt
      ? task.updatedAt - task.createdAt
      : steps.reduce((total, step) => total + (step.durationMs ?? 0), 0)

  const toggleStep = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div
      style={{
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        background: color.surfaceSunken,
        fontSize: fontSize.xs,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setToggled(!open)}
          aria-expanded={open}
          aria-label={t('run.toggle')}
          className="ui-run-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space.sm,
            flex: 1,
            minWidth: 0,
            boxSizing: 'border-box',
            padding: '5px 8px',
            border: 'none',
            background: 'transparent',
            color: color.textBody,
            fontFamily: 'inherit',
            fontSize: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <Icon
            name={open ? 'chevron-down' : 'chevron-right'}
            size={12}
            style={{ color: color.textFaint }}
          />
          <span style={{ fontWeight: 500, color: color.textSecondary }}>{t('run.title')}</span>
          <span style={{ color: statusMeta.tone }}>{t(statusMeta.labelKey)}</span>
          <span style={{ color: color.textFaint }}>
            {t('run.stepCount', { count: stepCount })}
          </span>
          {durationMs > 0 && (
            <span style={{ color: color.textFaint, marginLeft: 'auto' }}>
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </button>

        {/* 重新生成：只对能安全重跑的那条回答出现（由调用方决定） */}
        {onRetry && (
          <IconButton
            icon="refresh"
            size="xs"
            label={t('run.retry')}
            onClick={onRetry}
            style={{ flex: 'none', marginRight: 4, color: color.textFaint }}
          />
        )}
      </div>

      {open && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: space.xs,
            padding: `0 ${space.md}px ${space.md}px`,
          }}
        >
          {loading && <LoadingRow label={t('run.loading')} />}
          {!loading && steps.length === 0 && (
            <div style={{ color: color.textFaint }}>{t('run.empty')}</div>
          )}
          {steps.map((step) => (
            <ToolEventItem
              key={step.id}
              event={step}
              expanded={expandedSteps.has(step.id)}
              onToggle={() => toggleStep(step.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** 把落盘步骤转成与实时事件相同的形状，复用步骤行 */
function stepToEvent(step: LogStepRecord): AgentToolEvent {
  return {
    id: String(step.id ?? `${step.taskId}-${step.round}-${step.createdAt}`),
    round: step.round,
    name: step.toolName,
    argsPreview: step.argsRedacted,
    status: step.ok ? 'success' : 'error',
    durationMs: step.durationMs,
    summary: step.message,
    errorCode: step.code as AgentToolEvent['errorCode'],
  }
}
