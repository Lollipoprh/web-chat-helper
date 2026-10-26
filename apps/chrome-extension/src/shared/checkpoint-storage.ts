// Agent 任务检查点持久化
// 与聊天历史（chatMessages）和供应商配置隔离；只保存活动中的一个任务
// Side Panel 关闭或扩展重启后，下次打开会读到中断的检查点并标记"已中断"

import type { ChatMessage } from 'llm-client'

export interface AgentCheckpointRecord {
  taskId: string
  messages: ChatMessage[]
  rounds: number
  updatedAt: number
}

const CHECKPOINT_STORAGE_KEY = 'agentCheckpoint'
const MAX_MESSAGES = 200

export async function loadAgentCheckpoint(): Promise<AgentCheckpointRecord | null> {
  const stored = await chrome.storage.local.get(CHECKPOINT_STORAGE_KEY)
  const raw = stored[CHECKPOINT_STORAGE_KEY]
  if (!raw || typeof raw !== 'object') return null
  const record = raw as AgentCheckpointRecord
  if (
    typeof record.taskId !== 'string' ||
    typeof record.rounds !== 'number' ||
    typeof record.updatedAt !== 'number' ||
    !Array.isArray(record.messages)
  ) {
    return null
  }
  return record
}

export async function saveAgentCheckpoint(record: AgentCheckpointRecord): Promise<void> {
  const trimmed: AgentCheckpointRecord = {
    ...record,
    messages: record.messages.slice(-MAX_MESSAGES),
    updatedAt: Date.now(),
  }
  await chrome.storage.local.set({ [CHECKPOINT_STORAGE_KEY]: trimmed })
}

export async function clearAgentCheckpoint(): Promise<void> {
  await chrome.storage.local.remove(CHECKPOINT_STORAGE_KEY)
}

// 变化监听：Side Panel 主动保存/清除 checkpoint 后，监听方可以同步 UI
export function addCheckpointListener(listener: (record: AgentCheckpointRecord | null) => void): void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'local') return
    const change = changes[CHECKPOINT_STORAGE_KEY]
    if (!change) return
    if (change.newValue === undefined) listener(null)
    else if (isCheckpointRecord(change.newValue)) listener(change.newValue)
  }
  chrome.storage.onChanged.addListener(handler)
}

function isCheckpointRecord(value: unknown): value is AgentCheckpointRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.taskId === 'string' &&
    typeof record.rounds === 'number' &&
    typeof record.updatedAt === 'number' &&
    Array.isArray(record.messages)
  )
}
