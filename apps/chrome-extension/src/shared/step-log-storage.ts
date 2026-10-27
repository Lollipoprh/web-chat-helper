// 任务与步骤日志的 IndexedDB 持久化
//
// 与 chrome.storage.local 分工：
//   - chrome.storage.local：供应商配置、聊天历史、检查点（少量，必须精确，配额 5MB）
//   - IndexedDB：可裁剪的运行日志（量大，按任务检索，按保留策略滚动）
//
// 落盘内容只保留脱敏摘要，绝不写入页面正文、快照全文、表单值与密钥。

import type { AgentToolLog, StopReason } from 'agent-core'

export const LOG_DB_NAME = 'web-chat-helper'
export const LOG_DB_VERSION = 1

/** 保留时长（天） */
export const LOG_RETENTION_DAYS = 90
/** 任务数上限，与保留时长同时生效，先到者为准 */
export const LOG_MAX_TASKS = 2_000
/** 单任务事件上限，超出时优先丢弃最旧的只读事件 */
export const LOG_MAX_STEPS_PER_TASK = 50
/** 单字段落盘上限，超出截断并标记 */
export const LOG_MAX_FIELD_CHARS = 1_000

const TASK_STORE = 'tasks'
const STEP_STORE = 'steps'
const TASK_CREATED_INDEX = 'by_createdAt'
const STEP_TASK_INDEX = 'by_taskId'
const DAY_MS = 24 * 60 * 60 * 1_000

export type LogTaskStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted'

export interface LogTaskRecord {
  taskId: string
  createdAt: number
  updatedAt: number
  /** 用户任务原文（截断） */
  goal: string
  tabId?: number
  tabUrl?: string
  status: LogTaskStatus
  /** 已执行到的轮次 */
  rounds: number
  stopReason?: StopReason
  /** 已落盘的步骤数 */
  stepCount: number
  /** 因上限被丢弃的步骤数 */
  droppedSteps: number
}

export interface LogStepRecord {
  id?: number
  taskId: string
  createdAt: number
  round: number
  toolName: string
  argsRedacted: string
  ok: boolean
  code?: string
  message: string
  durationMs: number
  readOnly: boolean
  truncated: boolean
}

export interface LogStats {
  taskCount: number
  stepCount: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOG_DB_NAME, LOG_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TASK_STORE)) {
        const store = db.createObjectStore(TASK_STORE, { keyPath: 'taskId' })
        store.createIndex(TASK_CREATED_INDEX, 'createdAt')
      }
      if (!db.objectStoreNames.contains(STEP_STORE)) {
        const store = db.createObjectStore(STEP_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex(STEP_TASK_INDEX, 'taskId')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('无法打开本地日志数据库'))
  })
  return dbPromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('日志读写失败'))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('日志事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('日志事务被中止'))
  })
}

/** 截断单个字段，返回是否发生了截断 */
function clamp(value: string): { text: string; truncated: boolean } {
  if (value.length <= LOG_MAX_FIELD_CHARS) return { text: value, truncated: false }
  return { text: `${value.slice(0, LOG_MAX_FIELD_CHARS)}…`, truncated: true }
}

/** 任务开始时写入任务记录（同一 taskId 重复调用不会覆盖已有状态） */
export async function recordTaskStart(input: {
  taskId: string
  goal: string
  tabId?: number
  tabUrl?: string
}): Promise<void> {
  const db = await openDb()
  const now = Date.now()
  const tx = db.transaction(TASK_STORE, 'readwrite')
  const store = tx.objectStore(TASK_STORE)
  const existing = await requestResult<LogTaskRecord | undefined>(
    store.get(input.taskId) as IDBRequest<LogTaskRecord | undefined>,
  )

  if (existing === undefined) {
    const record: LogTaskRecord = {
      taskId: input.taskId,
      createdAt: now,
      updatedAt: now,
      goal: clamp(input.goal).text,
      tabId: input.tabId,
      tabUrl: input.tabUrl,
      status: 'running',
      rounds: 0,
      stepCount: 0,
      droppedSteps: 0,
    }
    store.put(record)
  }

  await txDone(tx)
}

/** 追加一条步骤日志，同时维护任务记录的轮次与计数 */
export async function recordStep(
  log: AgentToolLog,
  context: {
    taskId: string
    goal: string
    tabId?: number
    tabUrl?: string
    readOnly: boolean
  },
): Promise<void> {
  const db = await openDb()
  const now = Date.now()
  const tx = db.transaction([TASK_STORE, STEP_STORE], 'readwrite')
  const taskStore = tx.objectStore(TASK_STORE)
  const stepStore = tx.objectStore(STEP_STORE)

  const existing = await requestResult<LogTaskRecord | undefined>(
    taskStore.get(context.taskId) as IDBRequest<LogTaskRecord | undefined>,
  )

  const task: LogTaskRecord =
    existing ??
    ({
      taskId: context.taskId,
      createdAt: now,
      updatedAt: now,
      goal: clamp(context.goal).text,
      tabId: context.tabId,
      tabUrl: context.tabUrl,
      status: 'running',
      rounds: 0,
      stepCount: 0,
      droppedSteps: 0,
    } satisfies LogTaskRecord)

  let stored = true
  if (task.stepCount >= LOG_MAX_STEPS_PER_TASK) {
    // 超出上限时先淘汰该任务最旧的只读事件；没有可淘汰的只读事件就只记丢弃计数
    stored = await dropOldestReadOnlyStep(stepStore, context.taskId)
  }

  if (stored) {
    const args = clamp(log.argsRedacted)
    const message = clamp(log.message)
    const step: LogStepRecord = {
      taskId: context.taskId,
      createdAt: now,
      round: log.round,
      toolName: log.toolName,
      argsRedacted: args.text,
      ok: log.ok,
      code: log.code,
      message: message.text,
      durationMs: log.durationMs,
      readOnly: context.readOnly,
      truncated: args.truncated || message.truncated,
    }
    stepStore.add(step)
    task.stepCount += 1
  } else {
    task.droppedSteps += 1
  }

  task.rounds = Math.max(task.rounds, log.round)
  task.updatedAt = now
  taskStore.put(task)

  await txDone(tx)
}

/** 删除该任务最旧的只读步骤；成功删除返回 true */
function dropOldestReadOnlyStep(
  stepStore: IDBObjectStore,
  taskId: string,
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const request = stepStore.index(STEP_TASK_INDEX).openCursor(IDBKeyRange.only(taskId))
    request.onerror = () => reject(request.error ?? new Error('读取日志失败'))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(false)
        return
      }
      const step = cursor.value as LogStepRecord
      if (step.readOnly) {
        cursor.delete()
        resolve(true)
        return
      }
      cursor.continue()
    }
  })
}

/** 任务结束：写入最终状态与停止原因 */
export async function finishTask(
  taskId: string,
  status: LogTaskStatus,
  stopReason?: StopReason,
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(TASK_STORE, 'readwrite')
  const store = tx.objectStore(TASK_STORE)
  const existing = await requestResult<LogTaskRecord | undefined>(
    store.get(taskId) as IDBRequest<LogTaskRecord | undefined>,
  )

  if (existing) {
    store.put({
      ...existing,
      status,
      stopReason,
      updatedAt: Date.now(),
    })
  }

  await txDone(tx)
}

/** 扩展启动时调用：把上次未被正常收尾的 running 任务标为 interrupted */
export async function markInterruptedTasks(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(TASK_STORE, 'readwrite')
  const store = tx.objectStore(TASK_STORE)
  const request = store.openCursor()

  await new Promise<void>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('读取任务列表失败'))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      const task = cursor.value as LogTaskRecord
      if (task.status === 'running') {
        cursor.update({ ...task, status: 'interrupted', updatedAt: Date.now() })
      }
      cursor.continue()
    }
  })

  await txDone(tx)
}

/**
 * 按保留策略清理：
 *   1. 删除早于保留时长的任务及其步骤（走 createdAt 索引，不做全表扫描）
 *   2. 任务总数超过上限时，从最旧的开始继续删除
 */
export async function pruneLogs(): Promise<void> {
  const db = await openDb()
  const cutoff = Date.now() - LOG_RETENTION_DAYS * DAY_MS
  const expiredIds = await collectTaskIdsBefore(db, cutoff)
  for (const taskId of expiredIds) await deleteTaskWithSteps(db, taskId)

  const taskCount = await countTasks(db)
  if (taskCount > LOG_MAX_TASKS) {
    const overflow = taskCount - LOG_MAX_TASKS
    const oldestIds = await collectOldestTaskIds(db, overflow)
    for (const taskId of oldestIds) await deleteTaskWithSteps(db, taskId)
  }
}

function collectTaskIdsBefore(db: IDBDatabase, cutoff: number): Promise<string[]> {
  const tx = db.transaction(TASK_STORE, 'readonly')
  const index = tx.objectStore(TASK_STORE).index(TASK_CREATED_INDEX)
  const request = index.openKeyCursor(IDBKeyRange.upperBound(cutoff, true))

  return new Promise<string[]>((resolve, reject) => {
    const ids: string[] = []
    request.onerror = () => reject(request.error ?? new Error('读取过期任务失败'))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(ids)
        return
      }
      ids.push(String(cursor.primaryKey))
      cursor.continue()
    }
  })
}

/** 按 createdAt 升序取最旧的 N 个任务 ID */
function collectOldestTaskIds(db: IDBDatabase, limit: number): Promise<string[]> {
  const tx = db.transaction(TASK_STORE, 'readonly')
  const index = tx.objectStore(TASK_STORE).index(TASK_CREATED_INDEX)
  const request = index.openKeyCursor()

  return new Promise<string[]>((resolve, reject) => {
    const ids: string[] = []
    request.onerror = () => reject(request.error ?? new Error('读取任务列表失败'))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor || ids.length >= limit) {
        resolve(ids)
        return
      }
      ids.push(String(cursor.primaryKey))
      cursor.continue()
    }
  })
}

async function countTasks(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(TASK_STORE, 'readonly')
  return requestResult(tx.objectStore(TASK_STORE).count())
}

async function deleteTaskWithSteps(db: IDBDatabase, taskId: string): Promise<void> {
  const tx = db.transaction([TASK_STORE, STEP_STORE], 'readwrite')
  tx.objectStore(TASK_STORE).delete(taskId)

  const stepStore = tx.objectStore(STEP_STORE)
  const request = stepStore.index(STEP_TASK_INDEX).openKeyCursor(IDBKeyRange.only(taskId))
  // 删除动作在游标回调内发起，保证事务处于活跃状态，避免跨请求等待导致事务提前提交
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    stepStore.delete(cursor.primaryKey)
    cursor.continue()
  }
  request.onerror = () => {
    // 游标失败会让事务悬空，主动中止后由 txDone 拒绝
    tx.abort()
  }

  await txDone(tx)
}

/** 设置页展示用的统计信息 */
export async function getLogStats(): Promise<LogStats> {
  const db = await openDb()
  const [taskCount, stepCount] = await Promise.all([
    countTasks(db),
    countSteps(db),
  ])
  return { taskCount, stepCount }
}

async function countSteps(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(STEP_STORE, 'readonly')
  return requestResult(tx.objectStore(STEP_STORE).count())
}

/** 清空全部日志，供设置页调用 */
export async function clearAllLogs(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([TASK_STORE, STEP_STORE], 'readwrite')
  tx.objectStore(TASK_STORE).clear()
  tx.objectStore(STEP_STORE).clear()
  await txDone(tx)
}
