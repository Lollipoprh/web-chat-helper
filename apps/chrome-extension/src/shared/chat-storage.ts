// 聊天历史持久化
// 只保存已完成的消息；流式进行中的内容不落盘，刷新后不会残留半截回复。
// 与供应商配置分开存放，读取时的键互不影响。

export type StoredChatRole = 'user' | 'assistant'

export interface StoredChatMessage {
  id: string
  role: StoredChatRole
  content: string
  createdAt: number
}

export const CHAT_MESSAGES_STORAGE_KEY = 'chatMessages'

/** 上限，避免长期使用把 storage.local 写满 */
const MAX_STORED_MESSAGES = 200

export async function loadChatMessages(): Promise<StoredChatMessage[]> {
  const stored = await chrome.storage.local.get(CHAT_MESSAGES_STORAGE_KEY)
  const raw = stored[CHAT_MESSAGES_STORAGE_KEY]
  if (!Array.isArray(raw)) return []

  return raw
    .filter(isStoredChatMessage)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-MAX_STORED_MESSAGES)
}

export async function saveChatMessages(messages: StoredChatMessage[]): Promise<void> {
  await chrome.storage.local.set({
    [CHAT_MESSAGES_STORAGE_KEY]: messages.slice(-MAX_STORED_MESSAGES),
  })
}

export async function clearChatMessages(): Promise<void> {
  await chrome.storage.local.remove(CHAT_MESSAGES_STORAGE_KEY)
}

function isStoredChatMessage(value: unknown): value is StoredChatMessage {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    (item.role === 'user' || item.role === 'assistant') &&
    typeof item.content === 'string' &&
    typeof item.createdAt === 'number'
  )
}
