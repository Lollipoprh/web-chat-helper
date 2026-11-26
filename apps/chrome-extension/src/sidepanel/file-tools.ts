// 文件读写工具：基于 File System Access API，操作用户预先绑定的本地文件
//
// 设计要点：
// - 工具只接受文件名（file_name），引用用户在侧边栏已绑定的文件，不接受路径。
// - 读取是只读工具，不弹确认；写入是副作用工具，走 requiresConfirmation 流程。
// - 绑定时已获用户授权，读写不再重复校验权限；句柄失效（文件被移动/删除）时直接报错。
// - 仅支持纯文本格式；二进制格式（.docx/.pdf/.xlsx 等）会被拒绝。

import type { AgentTool, JsonSchema, ToolResult } from 'agent-core'
import {
  getFileHandle,
  listBoundFiles,
  updateFileMeta,
} from '../shared/file-handle-store'
import { appendSessionArtifact, getSession } from '../shared/session-storage'

/** 视为纯文本的扩展名白名单；其余格式拒绝读取，避免返回乱码给模型 */
const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.text',
  '.json',
  '.csv',
  '.tsv',
  '.xml',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.rs',
  '.go',
  '.rb',
  '.php',
  '.sh',
  '.bash',
  '.zsh',
  '.yml',
  '.yaml',
  '.toml',
  '.ini',
  '.conf',
  '.log',
  '.sql',
  '.svg',
  '.env',
  '.gitignore',
  '.dockerfile',
])

const EMPTY_PARAMS: JsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

/**
 * 下载时用的 MIME。
 *
 * Chrome 会按 data URL / 响应的 MIME 修正下载文件的扩展名：MIME 是 text/plain 时，
 * 用户要的 report.md 会落成 report.txt（w3c/webextensions#856）。所以认识的文本格式
 * 必须给出与扩展名一致的 MIME；其余一律用 application/octet-stream —— Chrome 对
 * 未知 MIME 不改写 filename，扩展名保持原样。
 */
export function mimeForDownload(name: string): string {
  switch (getExtension(name)) {
    case '.txt':
    case '.text':
      return 'text/plain'
    case '.md':
    case '.markdown':
      return 'text/markdown'
    case '.json':
      return 'application/json'
    case '.csv':
      return 'text/csv'
    case '.tsv':
      return 'text/tab-separated-values'
    case '.xml':
      return 'application/xml'
    case '.html':
    case '.htm':
      return 'text/html'
    case '.css':
      return 'text/css'
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'text/javascript'
    case '.svg':
      return 'image/svg+xml'
    default:
      // .log / .yml / .py / .ts / 无扩展名……：让 Chrome 原样保留文件名
      return 'application/octet-stream'
  }
}

function isTextFile(name: string): boolean {
  // 无扩展名的文件也按文本处理（如 README、Makefile、Dockerfile）
  const ext = getExtension(name)
  return ext === '' || TEXT_EXTENSIONS.has(ext)
}

/** 按会话 + 文件名取已绑定文件，统一处理未绑定 / 句柄失效 / 非文本三类错误 */
async function resolveBoundFile(
  sessionId: string,
  fileName: string,
  action: string,
): Promise<{ file: File; handle: FileSystemFileHandle } | ToolResult> {
  const handle = await getFileHandle(sessionId, fileName)
  if (!handle) {
    return {
      ok: false,
      code: 'invalid_args',
      message: `当前会话未绑定文件「${fileName}」，请先调用 list_bound_files 确认可用文件名，或提醒用户重新添加`,
    }
  }

  let file: File
  try {
    file = await handle.getFile()
  } catch {
    return {
      ok: false,
      code: 'execution_failed',
      message: `文件「${fileName}」无法${action}，可能已被移动或删除。请提醒用户解绑后重新添加该文件`,
    }
  }

  if (!isTextFile(file.name)) {
    return {
      ok: false,
      code: 'unsupported_page',
      message: `文件「${file.name}」不是纯文本格式，暂不支持${action}（仅支持 .txt/.md/.json/.csv/代码文件等文本格式）`,
    }
  }

  return { file, handle }
}

function isResolved(
  result: { file: File; handle: FileSystemFileHandle } | ToolResult,
): result is { file: File; handle: FileSystemFileHandle } {
  return 'file' in result
}

/**
 * 清洗下载文件名：
 * - 统一用正斜杠，允许子目录（如 notes/todo.md）
 * - 拒绝绝对路径、盘符和 .. 目录穿越，避免写到下载目录之外
 * - 替换 Windows 非法字符，去掉结尾的点和空格
 * 返回 null 表示该文件名不可用。
 */
function sanitizeDownloadName(raw: string): string | null {
  const normalized = raw.trim().replace(/\\/g, '/')
  if (!normalized) return null
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return null

  const segments = normalized.split('/').filter((segment) => segment.length > 0)
  if (segments.length === 0) return null
  if (segments.some((segment) => segment === '..' || segment === '.')) return null

  const cleaned = segments.map((segment) => {
    const safe = segment.replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '')
    return safe || '_'
  })
  return cleaned.join('/')
}

/** 模型经常只给一个通用名（“下载”“export”），落盘后用户根本认不出内容 */
const GENERIC_FILE_STEMS = new Set([
  '下载',
  '导出',
  '文件',
  '未命名',
  '新建文件',
  'download',
  'export',
  'file',
  'untitled',
  'output',
  'new-file',
])

/** 清洗会话标题里的路径分隔符和非法字符，避免标题把文件带进子目录 */
function sanitizeStem(text: string): string {
  return text
    .replace(/[<>:"|?*/\\\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/, '')
    .trim()
}

/**
 * 决定最终写盘的文件名：
 * - 没写扩展名时补 `.md` —— 模型导出文本时最常要的就是 Markdown；
 * - 通用名（“下载”/“export”…）换成会话标题，避免下载目录里堆满“下载.md”。
 * 返回 null 表示文件名不可用。
 */
export function resolveDownloadName(raw: string, sessionTitle?: string): string | null {
  const sanitized = sanitizeDownloadName(raw)
  if (!sanitized) return null

  const slash = sanitized.lastIndexOf('/')
  const directory = slash >= 0 ? sanitized.slice(0, slash + 1) : ''
  const base = slash >= 0 ? sanitized.slice(slash + 1) : sanitized
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const extension = dot > 0 ? base.slice(dot) : ''

  const title = sessionTitle ? sanitizeStem(sessionTitle) : ''
  const nextStem =
    GENERIC_FILE_STEMS.has(stem.trim().toLowerCase()) && title
      ? title
      : stem || title || 'export'

  return `${directory}${nextStem}${extension || '.md'}`
}

/** 把文本编码成 data URL；用 data URL 而不是 blob URL，避免下载期间 object URL 被回收 */
function textToDataUrl(text: string, mime: string): { url: string; byteLength: number } {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return {
    url: `data:${mime};charset=utf-8;base64,${btoa(binary)}`,
    byteLength: bytes.length,
  }
}

/** 本工具发起的下载：等待 onDeterminingFilename 给它们改名 */
const pendingDownloads: Array<{ url: string; filename: string }> = []
let downloadNameListenerReady = false

/**
 * 某些环境会忽略 downloads.download 的 filename，把文件落成默认的「下载.md」：
 * Chrome 自身的下载流程在某些版本上如此，用户的下载管理器扩展（如 IDM / 迅雷）
 * 注册 onDeterminingFilename 后也会覆盖建议名（chromium 579563）。
 * 这里自己注册 onDeterminingFilename：本工具发起的下载显式 suggest 文件名，
 * 其余下载原样交回浏览器，不影响用户其他下载。
 */
function ensureDownloadNameListener(): void {
  if (downloadNameListenerReady) return
  downloadNameListenerReady = true
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    // 先按 URL 精确匹配；URL 被规范化时退回到「本扩展发起的最早一条」
    let index = pendingDownloads.findIndex((entry) => entry.url === item.url)
    if (index < 0 && item.byExtensionId === chrome.runtime.id) index = 0
    if (index < 0) {
      // 不是本工具发起的下载：让浏览器走默认逻辑
      suggest()
      return
    }
    const [entry] = pendingDownloads.splice(index, 1)
    suggest({ filename: entry.filename, conflictAction: 'overwrite' })
  })
}

/** 通过 chrome.downloads 写文件，无需用户手势 */
function startDownload(url: string, filename: string): Promise<number> {
  ensureDownloadNameListener()
  const entry = { url, filename }
  pendingDownloads.push(entry)
  // 监听器没触发（或下载直接失败）时清掉，避免长 data URL 长期占内存
  window.setTimeout(() => {
    const index = pendingDownloads.indexOf(entry)
    if (index >= 0) pendingDownloads.splice(index, 1)
  }, 30_000)
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url, filename, conflictAction: 'overwrite', saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError || typeof downloadId !== 'number') {
          reject(new Error(chrome.runtime.lastError?.message ?? '下载任务创建失败'))
          return
        }
        resolve(downloadId)
      },
    )
  })
}

/**
 * 读回 Chrome 实际写下的文件名。
 * 下载管理器一类的扩展可以注册 onDeterminingFilename 改写名字，此时我们给的 filename
 * 会被忽略（chromium 579563），回复里必须说实际名字，不能照抄请求的名字。
 */
function getSavedFileName(downloadId: number): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.downloads.search({ id: downloadId }, (items) => {
      if (chrome.runtime.lastError) {
        resolve(null)
        return
      }
      const absolute = items[0]?.filename
      if (!absolute) {
        resolve(null)
        return
      }
      const parts = absolute.split(/[\\/]/)
      resolve(parts[parts.length - 1] || null)
    })
  })
}

/** 创建当前会话的文件读写工具集合，在 Side Panel 的 agent loop 中注册 */
export function createFileTools(sessionId: string): AgentTool[] {
  return [
    {
      name: 'list_bound_files',
      description:
        'List the local files the user has bound to the current chat session, each with file name, size and last modified time. Call this before read_file or write_file to learn which files are available. Returns an empty list if no file is bound.',
      parameters: EMPTY_PARAMS,
      readOnly: true,
      async execute(): Promise<ToolResult> {
        const files = await listBoundFiles(sessionId)
        if (files.length === 0) {
          return {
            ok: true,
            data: [],
            message:
              '当前会话没有绑定任何本地文件。如需新建文件，可直接调用 download_file 保存到系统下载目录。',
          }
        }
        return {
          ok: true,
          data: files,
          message: `当前会话已绑定 ${files.length} 个文件：${files.map((f) => f.name).join('、')}`,
        }
      },
    },
    {
      name: 'read_file',
      description:
        'Read the text content of a bound local file by its file name. Use list_bound_files first to get available file names. Only plain-text files (.txt, .md, .json, .csv, code files, etc.) are supported; binary files like .docx/.pdf/.xlsx are rejected. The full text is returned so the model can analyze it.',
      parameters: {
        type: 'object',
        properties: {
          file_name: {
            type: 'string',
            description: 'The name of the bound file, from list_bound_files',
          },
        },
        required: ['file_name'],
        additionalProperties: false,
      },
      readOnly: true,
      async execute(args): Promise<ToolResult> {
        const resolved = await resolveBoundFile(sessionId, String(args.file_name), '读取')
        if (!isResolved(resolved)) return resolved

        const { file } = resolved
        const content = await file.text()
        return {
          ok: true,
          data: { name: file.name, size: file.size, content },
          message: `已读取文件「${file.name}」，共 ${file.size} 字节`,
        }
      },
    },
    {
      name: 'write_file',
      description:
        'Write text content to a bound local file by its file name. Use list_bound_files first to get available file names. By default the file is overwritten; set mode to "append" to add content at the end. This is a side-effecting action that requires user confirmation. Only plain-text content is supported.',
      parameters: {
        type: 'object',
        properties: {
          file_name: {
            type: 'string',
            description: 'The name of the bound file, from list_bound_files',
          },
          content: {
            type: 'string',
            description: 'Text content to write',
          },
          mode: {
            type: 'string',
            enum: ['overwrite', 'append'],
            description: 'overwrite (default) replaces the whole file; append adds to the end',
          },
        },
        required: ['file_name', 'content'],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      async execute(args): Promise<ToolResult> {
        const content = String(args.content)
        const mode = args.mode === 'append' ? 'append' : 'overwrite'

        const resolved = await resolveBoundFile(sessionId, String(args.file_name), '写入')
        if (!isResolved(resolved)) return resolved

        const { file, handle } = resolved
        try {
          const writable = await handle.createWritable()
          if (mode === 'append') {
            await writable.seek(file.size)
          }
          await writable.write(content)
          await writable.close()
        } catch (error) {
          return {
            ok: false,
            code: 'execution_failed',
            message: `写入文件失败：${error instanceof Error ? error.message : String(error)}`,
          }
        }

        // 写入成功后回写元数据，让侧边栏列表显示最新的大小与修改时间
        try {
          const updated = await handle.getFile()
          await updateFileMeta(sessionId, updated.name, updated.size, updated.lastModified)
        } catch (error) {
          // 元数据回写失败不影响写入结果本身
          console.warn('[file] 回写文件元数据失败', error)
        }

        return {
          ok: true,
          data: { name: file.name, bytesWritten: content.length, mode },
          message: `已${mode === 'append' ? '追加' : '覆盖'}写入文件「${file.name}」，共 ${content.length} 字节`,
        }
      },
    },
    {
      name: 'download_file',
      description:
        'Save text content as a new file into the browser Downloads folder, without requiring the user to bind a file. Use this when the user wants a new file written and no bound file fits. filename is relative to the Downloads folder and may include a subdirectory, for example "notes/todo.md"; absolute paths and ".." are rejected. Give the file a descriptive name with the extension the user asked for — never use a generic name such as "download" or "export". An existing file with the same name is overwritten. This is a side-effecting action that requires user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description:
              'Descriptive file name relative to the Downloads folder, e.g. "weekly-report.md" or "notes/todo.md". Include the extension. No absolute paths, no "..".',
          },
          content: {
            type: 'string',
            description: 'Text content to write into the file',
          },
        },
        required: ['filename', 'content'],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      async execute(args): Promise<ToolResult> {
        const content = String(args.content ?? '')
        let sessionTitle: string | undefined
        try {
          sessionTitle = (await getSession(sessionId))?.title
        } catch {
          // 读不到标题不影响下载，退回到请求里的名字
        }
        const safeName = resolveDownloadName(String(args.filename ?? ''), sessionTitle)
        if (!safeName) {
          return {
            ok: false,
            code: 'invalid_args',
            message:
              '文件名无效：不能为空、不能是绝对路径、不能包含 ..；如需子目录请用正斜杠分隔（如 notes/todo.md）',
          }
        }

        try {
          const { url, byteLength } = textToDataUrl(content, mimeForDownload(safeName))
          const downloadId = await startDownload(url, safeName)
          // Chrome（或别的下载管理器扩展）可能改写文件名，以磁盘上的实际名字为准
          const savedName = (await getSavedFileName(downloadId)) ?? safeName
          // 只在会话里记一条元数据；文件本体已经在下载目录，不重复存
          try {
            await appendSessionArtifact(sessionId, {
              name: savedName,
              downloadId,
              bytes: byteLength,
              createdAt: Date.now(),
            })
          } catch (error) {
            console.warn('[file] 产物登记失败', error)
          }
          return {
            ok: true,
            data: { downloadId, filename: savedName, bytesWritten: byteLength },
            message:
              savedName === safeName
                ? `已保存到下载目录：${savedName}（${byteLength} 字节）`
                : `已保存到下载目录：${savedName}（${byteLength} 字节；浏览器没有采用请求的文件名 ${safeName}，被改写了，可提醒用户检查下载管理器扩展）`,
          }
        } catch (error) {
          return {
            ok: false,
            code: 'execution_failed',
            message: `保存文件失败：${error instanceof Error ? error.message : String(error)}`,
          }
        }
      },
    },
  ]
}
