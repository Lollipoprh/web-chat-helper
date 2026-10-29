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

function isTextFile(name: string): boolean {
  // 无扩展名的文件也按文本处理（如 README、Makefile、Dockerfile）
  const ext = getExtension(name)
  return ext === '' || TEXT_EXTENSIONS.has(ext)
}

/** 按文件名取已绑定文件，统一处理未绑定 / 句柄失效 / 非文本三类错误 */
async function resolveBoundFile(
  fileName: string,
  action: string,
): Promise<{ file: File; handle: FileSystemFileHandle } | ToolResult> {
  const handle = await getFileHandle(fileName)
  if (!handle) {
    return {
      ok: false,
      code: 'invalid_args',
      message: `未找到已绑定的文件「${fileName}」，请先调用 list_bound_files 确认可用文件名`,
    }
  }

  let file: File
  try {
    file = await handle.getFile()
  } catch {
    return {
      ok: false,
      code: 'execution_failed',
      message: `文件「${fileName}」无法${action}，可能已被移动或删除，请用户重新绑定`,
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

/** 创建文件读写工具集合，在 Side Panel 的 agent loop 中注册 */
export function createFileTools(): AgentTool[] {
  return [
    {
      name: 'list_bound_files',
      description:
        'List the local files the user has bound to this extension, each with file name, size and last modified time. Call this before read_file or write_file to learn which files are available. Returns an empty list if no file is bound.',
      parameters: EMPTY_PARAMS,
      readOnly: true,
      async execute(): Promise<ToolResult> {
        const files = await listBoundFiles()
        if (files.length === 0) {
          return {
            ok: true,
            data: [],
            message: '当前没有绑定任何本地文件。请用户在侧边栏「文件管理」中绑定文件后再试。',
          }
        }
        return {
          ok: true,
          data: files,
          message: `已绑定 ${files.length} 个文件：${files.map((f) => f.name).join('、')}`,
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
        const resolved = await resolveBoundFile(String(args.file_name), '读取')
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

        const resolved = await resolveBoundFile(String(args.file_name), '写入')
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
          await updateFileMeta(updated.name, updated.size, updated.lastModified)
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
  ]
}
