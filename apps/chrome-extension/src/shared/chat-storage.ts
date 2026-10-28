// 旧版聊天历史（chrome.storage.local）
// 仅用于升级时把旧记录迁移到会话库；迁移完成后由 session-storage 负责落盘。

export type StoredChatRole = 'user' | 'assistant'

export interface StoredChatMessage {
  id: string
  role: StoredChatRole
  content: string
  createdAt: number
}

export const CHAT_MESSAGES_STORAGE_KEY = 'chatMessages'

/** 上限，避免迁移时读取过多旧数据 */
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
