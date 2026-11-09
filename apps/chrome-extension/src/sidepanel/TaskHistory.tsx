// 当前会话的任务记录：按会话读取 IndexedDB 中的任务，展开查看每一步工具调用。
// 只展示已落盘的脱敏摘要，不读取页面内容。

import { useCallback, useEffect, useState } from 'react'
import {
  listSessionTasks,
  listTaskSteps,
  type LogStepRecord,
  type LogTaskRecord,
  type LogTaskStatus,
} from '../shared/step-log-storage'
import { Badge, Button, Card, color, fontSize, radius, space, type BadgeTone } from '../ui'
import type { MessageKey } from '../shared/i18n'
import { useI18n } from '../shared/useI18n'

interface TaskHistoryProps {
  sessionId: string
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
}

const STATUS_TONES: Record<LogTaskStatus, BadgeTone> = {
  running: 'neutral',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  interrupted: 'warning',
}

export default function TaskHistory({ sessionId }: TaskHistoryProps) {
  const { t } = useI18n()
  const [tasks, setTasks] = useState<LogTaskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [stepView, setStepView] = useState<StepView | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      setTasks(await listSessionTasks(sessionId))
    } catch (error) {
      console.warn('[history] 读取任务记录失败', error)
    } finally {
      setLoading(false)
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space.md,
          marginBottom: 10,
        }}
      >
        <div style={{ flex: 1, color: color.textMuted }}>
          {t('history.summary', { count: tasks.length })}
        </div>
        <Button
          size="xs"
          variant="secondary"
          onClick={() => void loadTasks()}
          disabled={loading}
        >
          {t('history.refresh')}
        </Button>
      </div>

      {loading ? (
        <p style={{ color: color.textFaint }}>{t('common.loading')}</p>
      ) : tasks.length === 0 ? (
        <p style={{ color: color.textFaint }}>{t('history.empty')}</p>
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
                <Badge tone={STATUS_TONES[task.status]} style={{ marginLeft: 0 }}>
                  {t(STATUS_LABELS[task.status])}
                </Badge>
                <span style={{ color: color.textFaint }}>{formatTime(task.createdAt)}</span>
                <span style={{ color: color.textFaint, marginLeft: 'auto' }}>
                  {t('history.roundsSteps', { rounds: task.rounds, steps: task.stepCount })}
                  {task.droppedSteps > 0
                    ? t('history.dropped', { count: task.droppedSteps })
                    : ''}
                </span>
              </div>
              <div style={{ color: color.text, wordBreak: 'break-word' }}>{task.goal}</div>
              {task.tabUrl && (
                <div
                  style={{
                    color: color.textFaint,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={task.tabUrl}
                >
                  {task.tabUrl}
                </div>
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
                    <span style={{ color: color.textFaint }}>{t('history.readingSteps')}</span>
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
