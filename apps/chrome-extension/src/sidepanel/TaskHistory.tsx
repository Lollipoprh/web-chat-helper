// 当前会话的任务记录：按会话读取 IndexedDB 中的任务，展开查看每一步工具调用。
// 只展示已落盘的脱敏摘要，不读取页面内容。

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listSessionTasks,
  listTaskSteps,
  type LogStepRecord,
  type LogTaskRecord,
  type LogTaskStatus,
} from '../shared/step-log-storage'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingRow,
  SkeletonLines,
  Tooltip,
  color,
  fontSize,
  radius,
  space,
  type BadgeTone,
} from '../ui'
import type { MessageKey } from '../shared/i18n'
import { useI18n } from '../shared/useI18n'

interface TaskHistoryProps {
  /** 只读取这个会话的任务 */
  sessionId: string
  /** 会话标题，用于在列表头部标明作用范围 */
  sessionTitle?: string
  /** 能在对话里定位到的任务（对应消息仍在当前会话里） */
  locatableTaskIds?: Set<string>
  /** 点击「定位」后切回对话并滚动到那次运行 */
  onLocate?: (taskId: string) => void
}

interface StepView {
  taskId: string
  steps: LogStepRecord[] | null
}

const STATUS_LABELS: Record<LogTaskStatus, MessageKey> = {
  running: 'task.statusRunning',
  completed: 'task.statusCompleted',
  failed: 'task.statusFailed',
  cancelled: 'task.statusCancelled',
  interrupted: 'task.statusInterrupted',
  round_limit: 'task.statusRoundLimit',
}

const STATUS_TONES: Record<LogTaskStatus, BadgeTone> = {
  running: 'neutral',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  interrupted: 'warning',
  round_limit: 'warning',
}

export default function TaskHistory({
  sessionId,
  sessionTitle,
  locatableTaskIds,
  onLocate,
}: TaskHistoryProps) {
  const { t } = useI18n()
  const [tasks, setTasks] = useState<LogTaskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [stepView, setStepView] = useState<StepView | null>(null)
  // 会话切换时可能有多个读取在飞：只接受最后一次请求的结果，避免串到别的会话
  const requestRef = useRef(0)

  const loadTasks = useCallback(async () => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    try {
      const next = await listSessionTasks(sessionId)
      if (requestRef.current !== requestId) return
      setTasks(next)
    } catch (error) {
      console.warn('[history] 读取任务记录失败', error)
    } finally {
      if (requestRef.current === requestId) setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    setExpandedTaskId(null)
    setStepView(null)
    void loadTasks()
  }, [loadTasks])

  const handleToggle = async (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null)
      setStepView(null)
      return
    }

    setExpandedTaskId(taskId)
    setStepView({ taskId, steps: null })
    try {
      const steps = await listTaskSteps(taskId)
      setStepView((current) => (current?.taskId === taskId ? { taskId, steps } : current))
    } catch (error) {
      console.warn('[history] 读取步骤失败', error)
      setStepView((current) => (current?.taskId === taskId ? { taskId, steps: [] } : current))
    }
  }

  return (
    <div style={{ fontSize: fontSize.sm }}>
      {/* 头部先标明作用范围：这份列表只属于当前会话 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space.md,
          marginBottom: 4,
        }}
      >
        <Tooltip
          content={sessionTitle?.trim() ? sessionTitle : t('sidepanel.noSession')}
          style={{ flex: 1, minWidth: 0, display: 'block' }}
        >
          <span
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: color.textSecondary,
            }}
          >
            {t('history.sessionLabel', {
              title: sessionTitle?.trim() ? sessionTitle : t('sidepanel.noSession'),
            })}
          </span>
        </Tooltip>
        <Button
          size="xs"
          variant="secondary"
          onClick={() => void loadTasks()}
          disabled={loading}
        >
          {t('history.refresh')}
        </Button>
      </div>

      <div
        style={{
          color: color.textFaint,
          fontSize: fontSize.xs,
          marginBottom: 10,
        }}
      >
        {t('history.summary', { count: tasks.length })}
      </div>

      {loading ? (
        <SkeletonLines lines={3} />
      ) : tasks.length === 0 ? (
        <EmptyState compact icon="list" description={t('history.empty')} />
      ) : (
        tasks.map((task) => (
          <Card
            key={task.taskId}
            style={{
              padding: '8px 10px',
              borderRadius: radius.lg,
              marginBottom: space.md,
            }}
          >
            <div
              onClick={() => void handleToggle(task.taskId)}
              style={{ cursor: 'pointer' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space.md,
                  marginBottom: space.xs,
                }}
              >
                <Badge tone={STATUS_TONES[task.status]}>
                  {t(STATUS_LABELS[task.status])}
                </Badge>
                <span style={{ color: color.textFaint }}>{formatTime(task.createdAt)}</span>
                <span style={{ color: color.textFaint, marginLeft: 'auto' }}>
                  {t('history.roundsSteps', { rounds: task.rounds, steps: task.stepCount })}
                  {task.droppedSteps > 0
                    ? t('history.dropped', { count: task.droppedSteps })
                    : ''}
                </span>
                {/* 运行块已经展示步骤细节，这里只需要能跳回那次运行 */}
                {onLocate && locatableTaskIds?.has(task.taskId) && (
                  <Button
                    size="xs"
                    variant="text"
                    onClick={(event) => {
                      event.stopPropagation()
                      onLocate(task.taskId)
                    }}
                    style={{ flex: 'none', color: color.primarySoftText, padding: '0 4px' }}
                  >
                    {t('history.locate')}
                  </Button>
                )}
              </div>
              <div style={{ color: color.text, wordBreak: 'break-word' }}>{task.goal}</div>
              {task.tabUrl && (
                <Tooltip content={task.tabUrl} style={{ display: 'block', marginTop: 2 }}>
                  <div
                    style={{
                      color: color.textFaint,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {task.tabUrl}
                  </div>
                </Tooltip>
              )}
              {task.stopReason && task.stopReason !== 'completed' && (
                <div style={{ color: color.textFaint, marginTop: 2 }}>
                  {t('history.stopReason', { reason: task.stopReason })}
                </div>
              )}
            </div>

            {expandedTaskId === task.taskId && (
              <div
                style={{
                  marginTop: space.md,
                  borderTop: `1px solid ${color.borderMuted}`,
                  paddingTop: space.md,
                }}
              >
                {stepView?.taskId === task.taskId ? (
                  stepView.steps === null ? (
                    <LoadingRow label={t('history.readingSteps')} />
                  ) : stepView.steps.length === 0 ? (
                    <span style={{ color: color.textFaint }}>{t('history.noSteps')}</span>
                  ) : (
                    stepView.steps.map((step, index) => (
                      <div
                        key={step.id ?? `${step.taskId}-${index}`}
                        style={{
                          border: `1px solid ${color.borderMuted}`,
                          borderRadius: radius.md,
                          padding: '5px 8px',
                          marginBottom: space.sm,
                          background: color.surfaceMuted,
                        }}
                      >
                        <div
                          style={{ display: 'flex', gap: space.sm, alignItems: 'center' }}
                        >
                          <span style={{ color: color.textFaint }}>#{step.round}</span>
                          <span style={{ fontFamily: 'monospace' }}>{step.toolName}</span>
                          <span
                            style={{
                              color: step.ok ? color.success : color.danger,
                              marginLeft: 'auto',
                            }}
                          >
                            {step.ok ? t('history.stepSuccess') : (step.code ?? t('history.stepFailed'))}
                          </span>
                          <span style={{ color: color.textFaint }}>{step.durationMs}ms</span>
                        </div>
                        <div
                          style={{
                            color: color.textMuted,
                            marginTop: 2,
                            wordBreak: 'break-all',
                          }}
                        >
                          {step.argsRedacted}
                        </div>
                        <div
                          style={{
                            color: step.ok ? color.textMuted : color.danger,
                            marginTop: 2,
                            wordBreak: 'break-word',
                          }}
                        >
                          {step.message}
                        </div>
                        {step.truncated && (
                          <div style={{ color: color.textFaint, marginTop: 2 }}>
                            {t('history.truncated')}
                          </div>
                        )}
                      </div>
                    ))
                  )
                ) : null}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  )
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getMonth() + 1}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
