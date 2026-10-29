// 文件句柄存储：基于 File System Access API 的本地文件绑定管理
//
// 设计要点：
// - 用户在 UI 中通过 showOpenFilePicker 选择文件后，把 FileSystemFileHandle 存入 IndexedDB，
//   以文件名为主键。agent 工具通过文件名引用文件，避免工具执行时需要用户手势。
// - 句柄是结构化克隆友好的，可以直接存入 IndexedDB；chrome.storage.local 不支持。
// - 绑定时已获用户授权，后续读写不再重复校验权限；文件被移动/删除时读写会抛错，直接返回失败。
// - 列表展示只用绑定时刻落库的元数据，不调用 handle.getFile()。
//   反序列化出来的句柄不保证仍带授权，若在列表里调用 getFile 并跳过失败项，
//   就会出现“文件还在库里、却从列表中消失”的现象。
// - 另用内存缓存保存绑定时拿到的活句柄（带授权），读写优先使用它。

import {
  FILE_HANDLE_STORE,
  openLocalDb,
  requestResult,
  txDone,
} from './local-db'

/** 已绑定文件的记录：句柄 + 元数据 */
export interface FileHandleRecord {
  /** 文件名，作为主键 */
  name: string
  /** File System Access API 的文件句柄 */
  handle: FileSystemFileHandle
  /** 绑定时刻的文件大小（字节） */
  size: number
  /** 绑定时刻的最后修改时间 */
  lastModified: number
  /** 绑定时间戳 */
  createdAt: number
}

/** 不含句柄的文件元数据，用于展示和返回给模型 */
export interface BoundFileMeta {
  name: string
  size: number
  lastModified: number
}

/** 绑定时拿到的活句柄缓存：重启前读写都优先用它，避免反序列化句柄丢权限 */
const liveHandles = new Map<string, FileSystemFileHandle>()

/**
 * 绑定一个本地文件。
 * 必须在用户手势（点击/键盘）中调用，否则 showOpenFilePicker 会被浏览器拒绝。
 * 同名文件会覆盖旧绑定。
 */
export async function bindFile(): Promise<FileHandleRecord> {
  const [handle] = await window.showOpenFilePicker({ multiple: false })
  const file = await handle.getFile()

  const record: FileHandleRecord = {
    name: file.name,
    handle,
    size: file.size,
    lastModified: file.lastModified,
    createdAt: Date.now(),
  }

  const db = await openLocalDb()
  const tx = db.transaction(FILE_HANDLE_STORE, 'readwrite')
  tx.objectStore(FILE_HANDLE_STORE).put(record)
  await txDone(tx)

  liveHandles.set(record.name, handle)
  return record
}

/** 按文件名获取句柄；未绑定时返回 null */
export async function getFileHandle(name: string): Promise<FileSystemFileHandle | null> {
  const cached = liveHandles.get(name)
  if (cached) return cached

  const db = await openLocalDb()
  const tx = db.transaction(FILE_HANDLE_STORE, 'readonly')
  const record = await requestResult<FileHandleRecord | undefined>(
    tx.objectStore(FILE_HANDLE_STORE).get(name),
  )
  if (!record?.handle) return null

  liveHandles.set(name, record.handle)
  return record.handle
}

/** 列出所有已绑定文件的元数据（不含句柄，不读取文件本体） */
export async function listBoundFiles(): Promise<BoundFileMeta[]> {
  const db = await openLocalDb()
  const tx = db.transaction(FILE_HANDLE_STORE, 'readonly')
  const records = await requestResult<FileHandleRecord[]>(
    tx.objectStore(FILE_HANDLE_STORE).getAll(),
  )

  return records.map((record) => ({
    name: record.name,
    // 早期记录未落库 size/lastModified，缺失时按 0 展示，避免因读取失败而从列表消失
    size: typeof record.size === 'number' ? record.size : 0,
    lastModified: typeof record.lastModified === 'number' ? record.lastModified : 0,
  }))
}

/** 解绑文件：从 IndexedDB 删除句柄记录 */
export async function unbindFile(name: string): Promise<void> {
  liveHandles.delete(name)

  const db = await openLocalDb()
  const tx = db.transaction(FILE_HANDLE_STORE, 'readwrite')
  tx.objectStore(FILE_HANDLE_STORE).delete(name)
  await txDone(tx)
}

/**
 * 写入后回写元数据，让列表显示的大小/修改时间保持最新。
 * 读写放在同一个事务的回调里完成，避免 await 之后事务已自动提交导致 put 失效。
 */
export async function updateFileMeta(
  name: string,
  size: number,
  lastModified: number,
): Promise<void> {
  const db = await openLocalDb()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_HANDLE_STORE, 'readwrite')
    const store = tx.objectStore(FILE_HANDLE_STORE)
    const getRequest = store.get(name)

    getRequest.onsuccess = () => {
      const record = getRequest.result as FileHandleRecord | undefined
      if (record) store.put({ ...record, size, lastModified })
    }
    getRequest.onerror = () => reject(getRequest.error ?? new Error('读取文件记录失败'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('数据库事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('数据库事务被中止'))
  })
}
