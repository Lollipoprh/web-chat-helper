// File System Access API 类型声明
// TypeScript 内置 DOM 库未包含这些 API（截至 ES2022 lib），在此补充。
// 仅声明本项目用到的部分，避免与未来官方类型冲突时过度覆盖。

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface OpenFilePickerOptions {
  multiple?: boolean
  excludeAcceptAllOption?: boolean
  types?: FilePickerAcceptType[]
}

interface Window {
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
}
