// 扩展本地 IndexedDB 的唯一入口
// 同时承载运行日志（tasks / steps）与会话历史（sessions / messages）。
// 所有模块必须经由这里打开数据库，避免各自使用不同版本号导致升级冲突。

export const LOCAL_DB_NAME = 'web-chat-helper'
export const LOCAL_DB_VERSION = 4

export const TASK_STORE = 'tasks'
export const STEP_STORE = 'steps'
export const SESSION_STORE = 'sessions'
export const MESSAGE_STORE = 'sessionMessages'
export const FILE_HANDLE_STORE = 'fileHandles'

export const TASK_CREATED_INDEX = 'by_createdAt'
export const TASK_SESSION_INDEX = 'by_sessionId'
export const STEP_TASK_INDEX = 'by_taskId'
export const SESSION_UPDATED_INDEX = 'by_updatedAt'
export const MESSAGE_SESSION_INDEX = 'by_sessionId'

let dbPromise: Promise<IDBDatabase> | null = null

export function openLocalDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const oldVersion = event.oldVersion

      if (!db.objectStoreNames.contains(TASK_STORE)) {
        const store = db.createObjectStore(TASK_STORE, { keyPath: 'taskId' })
        store.createIndex(TASK_CREATED_INDEX, 'createdAt')
      }
      if (!db.objectStoreNames.contains(STEP_STORE)) {
        const store = db.createObjectStore(STEP_STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex(STEP_TASK_INDEX, 'taskId')
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: 'sessionId' })
        store.createIndex(SESSION_UPDATED_INDEX, 'updatedAt')
      }
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        const store = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' })
        store.createIndex(MESSAGE_SESSION_INDEX, 'sessionId')
      }

      // v1 -> v2：为已有任务补 sessionId 索引，旧记录缺该字段时不会进入索引
      const taskStore = request.transaction?.objectStore(TASK_STORE)
      if (taskStore && !taskStore.indexNames.contains(TASK_SESSION_INDEX)) {
        taskStore.createIndex(TASK_SESSION_INDEX, 'sessionId')
      }

      // v2 -> v4：文件句柄存储以文件名为主键（v3 曾用 alias 别名，后移除别名机制，删除重建）
      // 仅在跨过 v4 时重建，避免后续任意一次升级都清空用户的文件绑定
      if (oldVersion < 4) {
        if (db.objectStoreNames.contains(FILE_HANDLE_STORE)) {
          db.deleteObjectStore(FILE_HANDLE_STORE)
        }
        db.createObjectStore(FILE_HANDLE_STORE, { keyPath: 'name' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('无法打开本地数据库'))
    request.onblocked = () =>
      reject(new Error('本地数据库升级被其他页面阻塞，请关闭其他扩展页面后重试'))
  })
  return dbPromise
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('数据库读写失败'))
  })
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('数据库事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('数据库事务被中止'))
  })
}

/**
 * 删除索引值为 value 的所有记录。
 * 删除动作全部在游标回调内发起，保证事务始终处于活跃状态。
 */
export function deleteByIndex(
  store: IDBObjectStore,
  indexName: string,
  value: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = store.index(indexName).openKeyCursor(IDBKeyRange.only(value))
    request.onerror = () => reject(request.error ?? new Error('读取索引失败'))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      store.delete(cursor.primaryKey)
      cursor.continue()
    }
  })
}
