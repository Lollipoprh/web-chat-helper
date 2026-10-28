// 会话与消息的 IndexedDB 持久化
//
// 一个会话对应 Side Panel 里的一段连续对话；任务日志通过 sessionId 与之关联。
// 只持久化已结束的消息（complete/error/cancelled），流式中间态不落盘。

import { clearChatMessages, loadChatMessages } from './chat-storage'
import {
  MESSAGE_SESSION_INDEX,
  MESSAGE_STORE,
  SESSION_STORE,
  deleteByIndex,
  openLocalDb,
  requestResult,
  txDone,
} from './local-db'

export const ACTIVE_SESSION_STORAGE_KEY = 'activeSessionId'
export const DEFAULT_SESSION_TITLE = '新会话'

const TITLE_MAX_CHARS = 30

export type SessionRole = 'user' | 'assistant'
export type SessionMessageStatus = 'complete' | 'error' | 'cancelled'

export interface SessionRecord {
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface SessionMessageRecord {
  id: string
  sessionId: string
  role: SessionRole
  content: string
  status: SessionMessageStatus
  createdAt: number
  error?: string
}

/** 新建空白会话 */
export async function createSession(): Promise<SessionRecord> {
  const db = await openLocalDb()
  const now = Date.now()
  const session: SessionRecord = {
    sessionId: crypto.randomUUID(),
    title: DEFAULT_SESSION_TITLE,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  }
  const tx = db.transaction(SESSION_STORE, 'readwrite')
  tx.objectStore(SESSION_STORE).put(session)
  await txDone(tx)
  return session
}

/** 全部会话，最近更新的在前 */
export async function listSessions(): Promise<SessionRecord[]> {
  const db = await openLocalDb()
  const tx = db.transaction(SESSION_STORE, 'readonly')
  const records = await requestResult<SessionRecord[]>(
    tx.objectStore(SESSION_STORE).getAll() as IDBRequest<SessionRecord[]>,
  )
  return records.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 读取一个会话的全部消息，按时间升序 */
export async function loadSessionMessages(sessionId: string): Promise<SessionMessageRecord[]> {
  const db = await openLocalDb()
  const tx = db.transaction(MESSAGE_STORE, 'readonly')
  const records = await requestResult<SessionMessageRecord[]>(
    tx.objectStore(MESSAGE_STORE).index(MESSAGE_SESSION_INDEX).getAll(
      IDBKeyRange.only(sessionId),
    ) as IDBRequest<SessionMessageRecord[]>,
  )
  return records.sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * 追加一条已结束的消息，并同步会话的标题、更新时间与消息数。
 * 相同 id 重复写入不会重复计数。
 */
export async function appendSessionMessage(
  sessionId: string,
  message: SessionMessageRecord,
): Promise<void> {
  const db = await openLocalDb()
  const now = Date.now()
  const tx = db.transaction([SESSION_STORE, MESSAGE_STORE], 'readwrite')
  const sessionStore = tx.objectStore(SESSION_STORE)
  const messageStore = tx.objectStore(MESSAGE_STORE)

  const session = await requestResult<SessionRecord | undefined>(
    sessionStore.get(sessionId) as IDBRequest<SessionRecord | undefined>,
  )
  const alreadyStored = await requestResult<SessionMessageRecord | undefined>(
    messageStore.get(message.id) as IDBRequest<SessionMessageRecord | undefined>,
  )
  messageStore.put({ ...message, sessionId })

  if (session) {
    const nextTitle =
      session.title === DEFAULT_SESSION_TITLE && message.role === 'user' && message.content
        ? deriveTitle(message.content)
        : session.title
    sessionStore.put({
      ...session,
      title: nextTitle,
      updatedAt: now,
      messageCount: alreadyStored ? session.messageCount : session.messageCount + 1,
    })
  }

  await txDone(tx)
}

/** 清空会话消息但保留会话本身 */
export async function clearSessionMessages(sessionId: string): Promise<void> {
  const db = await openLocalDb()
  const tx = db.transaction([SESSION_STORE, MESSAGE_STORE], 'readwrite')
  const sessionStore = tx.objectStore(SESSION_STORE)

  const session = await requestResult<SessionRecord | undefined>(
    sessionStore.get(sessionId) as IDBRequest<SessionRecord | undefined>,
  )
  if (session) {
    sessionStore.put({
      ...session,
      title: DEFAULT_SESSION_TITLE,
      messageCount: 0,
      updatedAt: Date.now(),
    })
  }
  await deleteByIndex(tx.objectStore(MESSAGE_STORE), MESSAGE_SESSION_INDEX, sessionId)

  await txDone(tx)
}

/** 删除会话及其全部消息 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await openLocalDb()
  const tx = db.transaction([SESSION_STORE, MESSAGE_STORE], 'readwrite')
  tx.objectStore(SESSION_STORE).delete(sessionId)
  await deleteByIndex(tx.objectStore(MESSAGE_STORE), MESSAGE_SESSION_INDEX, sessionId)
  await txDone(tx)
}

export async function getActiveSessionId(): Promise<string | null> {
  const stored = await chrome.storage.local.get(ACTIVE_SESSION_STORAGE_KEY)
  const value = stored[ACTIVE_SESSION_STORAGE_KEY]
  return typeof value === 'string' ? value : null
}

export async function setActiveSessionId(sessionId: string): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_SESSION_STORAGE_KEY]: sessionId })
}

/**
 * Side Panel 启动时调用：保证至少有一个会话。
 * 首次升级时把 chrome.storage.local 里的旧聊天记录迁移为一个会话。
 */
export async function ensureSessions(): Promise<{
  sessions: SessionRecord[]
  activeSessionId: string
}> {
  let sessions = await listSessions()

  if (sessions.length === 0) {
    sessions = await migrateLegacyMessages()
  }
  if (sessions.length === 0) {
    sessions = [await createSession()]
  }

  const storedId = await getActiveSessionId()
  const activeSessionId =
    sessions.find((session) => session.sessionId === storedId)?.sessionId ?? sessions[0].sessionId
  if (activeSessionId !== storedId) await setActiveSessionId(activeSessionId)

  return { sessions, activeSessionId }
}

async function migrateLegacyMessages(): Promise<SessionRecord[]> {
  const legacy = await loadChatMessages()
  if (legacy.length === 0) return []

  const session: SessionRecord = {
    sessionId: crypto.randomUUID(),
    title: deriveTitle(
      legacy.find((message) => message.role === 'user')?.content ?? DEFAULT_SESSION_TITLE,
    ),
    createdAt: legacy[0].createdAt,
    updatedAt: legacy[legacy.length - 1].createdAt,
    messageCount: legacy.length,
  }

  const db = await openLocalDb()
  const tx = db.transaction([SESSION_STORE, MESSAGE_STORE], 'readwrite')
  tx.objectStore(SESSION_STORE).put(session)
  const messageStore = tx.objectStore(MESSAGE_STORE)
  for (const message of legacy) {
    messageStore.put({
      id: message.id,
      sessionId: session.sessionId,
      role: message.role,
      content: message.content,
      status: 'complete',
      createdAt: message.createdAt,
    } satisfies SessionMessageRecord)
  }
  await txDone(tx)

  await clearChatMessages()
  return [session]
}

function deriveTitle(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (!collapsed) return DEFAULT_SESSION_TITLE
  return collapsed.length > TITLE_MAX_CHARS
    ? `${collapsed.slice(0, TITLE_MAX_CHARS)}…`
    : collapsed
}
