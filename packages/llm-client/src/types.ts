// 供应商配置的数据模型
// 这是持久化到 chrome.storage.local 的结构，字段一旦发布需要考虑迁移

export interface ProviderConfig {
  /** 稳定标识，删除/切换默认项时使用 */
  id: string
  /** 展示名称，由用户填写，不参与请求 */
  name: string
  /** 用户填写的 Base URL，可能是根地址、带版本地址或完整 /chat/completions 地址 */
  baseUrl: string
  /** API 密钥，仅用于请求头，禁止写入日志 */
  apiKey: string
  /** 模型名 */
  model: string
  /** 该供应商是否支持流式输出 */
  supportsStreaming: boolean
  /** 该供应商是否支持 Tool Calls */
  supportsToolCalls: boolean
  createdAt: number
  updatedAt: number
}

/** 创建新供应商时的初始值，id 与时间戳由调用方补齐 */
export type ProviderDraft = Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>

export function createProviderId(): string {
  return crypto.randomUUID()
}

/** 遮罩密钥，仅用于展示与日志：sk-abcd…wxyz */
export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
}
