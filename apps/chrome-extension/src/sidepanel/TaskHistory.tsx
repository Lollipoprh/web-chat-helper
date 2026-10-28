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

interface TaskHistoryProps {
  sessionId: string
}

interface StepView {
  taskId: string
  steps: LogStepRecord[] | null
}

const STATUS_LABELS: Record<LogTaskStatus, string> = {
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  interrupted: '已中断',
}

const STATUS_COLORS: Record<LogTaskStatus, string> = {
  running: '#9ca3af',
  completed: '#047857',
  failed: '#b91c1c',
  cancelled: '#6b7280',
  interrupted: '#d97706',
}

export default function TaskHistory({ sessionId }: TaskHistoryProps) {
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
    <div style={{ fontSize: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div style={{ flex: 1, color: '#6b7280' }}>
          共 {tasks.length} 个任务，点击查看工具调用明细
        </div>
        <button
          onClick={() => void loadTasks()}
          disabled={loading}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            cursor: loading ? 'not-allowed' : 'pointer',
            background: 'transparent',
            border: '1px solid #d4d4d4',
            borderRadius: 4,
            color: loading ? '#9ca3af' : '#111827',
          }}
        >
          刷新
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>加载中…</p>
      ) : tasks.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>当前会话还没有任务记录。发送任务后，工具调用步骤会显示在这里。</p>
      ) : (
        tasks.map((task) => (
          <div
            key={task.taskId}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '8px 10px',
              marginBottom: 8,
              background: '#fff',
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
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: STATUS_COLORS[task.status], fontWeight: 600 }}>
                  {STATUS_LABELS[task.status]}
                </span>
                <span style={{ color: '#9ca3af' }}>{formatTime(task.createdAt)}</span>
                <span style={{ color: '#9ca3af', marginLeft: 'auto' }}>
                  {task.rounds} 轮 · {task.stepCount} 步
                  {task.droppedSteps > 0 ? ` · 丢弃 ${task.droppedSteps}` : ''}
                </span>
              </div>
              <div style={{ color: '#111827', wordBreak: 'break-word' }}>{task.goal}</div>
              {task.tabUrl && (
                <div
                  style={{
                    color: '#9ca3af',
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
                <div style={{ color: '#9ca3af', marginTop: 2 }}>
                  停止原因：{task.stopReason}
                </div>
              )}
            </div>

            {expandedTaskId === task.taskId && (
              <div style={{ marginTop: 8, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                {stepView?.taskId === task.taskId ? (
                  stepView.steps === null ? (
                    <span style={{ color: '#9ca3af' }}>读取步骤…</span>
                  ) : stepView.steps.length === 0 ? (
                    <span style={{ color: '#9ca3af' }}>该任务没有落盘的步骤。</span>
                  ) : (
                    stepView.steps.map((step, index) => (
                      <div
                        key={step.id ?? `${step.taskId}-${index}`}
                        style={{
                          border: '1px solid #f3f4f6',
                          borderRadius: 6,
                          padding: '5px 8px',
                          marginBottom: 6,
                          background: '#fafafa',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: '#9ca3af' }}>#{step.round}</span>
                          <span style={{ fontFamily: 'monospace' }}>{step.toolName}</span>
                          <span
                            style={{
                              color: step.ok ? '#047857' : '#b91c1c',
                              marginLeft: 'auto',
                            }}
                          >
                            {step.ok ? '成功' : step.code ?? '失败'}
                          </span>
                          <span style={{ color: '#9ca3af' }}>{step.durationMs}ms</span>
                        </div>
                        <div style={{ color: '#6b7280', marginTop: 2, wordBreak: 'break-all' }}>
                          {step.argsRedacted}
                        </div>
                        <div
                          style={{
                            color: step.ok ? '#6b7280' : '#b91c1c',
                            marginTop: 2,
                            wordBreak: 'break-word',
                          }}
                        >
                          {step.message}
                        </div>
                        {step.truncated && (
                          <div style={{ color: '#9ca3af', marginTop: 2 }}>内容已截断</div>
                        )}
                      </div>
                    ))
                  )
                ) : null}
              </div>
            )}
          </div>
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
