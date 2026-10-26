// 统一的模型请求错误类型
// 用于把 HTTP 状态码、网络异常、协议异常收敛成可分类、可展示的错误

export type LLMErrorCode =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'rate_limit'
  | 'server'
  | 'protocol'
  | 'network'
  | 'timeout'
  | 'aborted'

export class LLMError extends Error {
  readonly code: LLMErrorCode
  /** HTTP 状态码；网络层失败时为空 */
  readonly status?: number

  constructor(code: LLMErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'LLMError'
    this.code = code
    this.status = status
  }
}

/** 按 HTTP 状态码生成错误，detail 为服务端返回的可读信息（已截断） */
export function httpStatusToLLMError(status: number, detail = ''): LLMError {
  const suffix = detail ? `：${detail}` : ''

  if (status === 401) {
    return new LLMError('auth', `认证失败（401），请检查 API Key${suffix}`, status)
  }
  if (status === 403) {
    return new LLMError('forbidden', `无权访问（403），密钥可能没有该模型权限${suffix}`, status)
  }
  if (status === 404) {
    return new LLMError(
      'not_found',
      `接口不存在（404），请检查 Base URL 是否缺少或重复版本路径${suffix}`,
      status,
    )
  }
  if (status === 402) {
    return new LLMError(
      'server',
      `账户额度不足（402），请检查供应商账户余额或配额，或更换 API Key${suffix}`,
      status,
    )
  }
  if (status === 429) {
    return new LLMError('rate_limit', `请求过于频繁或被限流（429）${suffix}`, status)
  }
  if (status >= 500) {
    return new LLMError('server', `服务端错误（${status}）${suffix}`, status)
  }
  if (status === 400 || status === 422) {
    return new LLMError('bad_request', `请求被拒绝（${status}），请检查模型名是否可用${suffix}`, status)
  }
  return new LLMError('server', `请求失败（${status}）${suffix}`, status)
}

/** 从错误响应体中尽量提取可读信息，超长截断，避免把整页 HTML 塞进界面 */
export function extractServerMessage(bodyText: string): string {
  if (!bodyText) return ''
  const trimmed = bodyText.trim()

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const error = parsed.error
    if (typeof error === 'string') return truncate(error)
    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>).message
      if (typeof message === 'string') return truncate(message)
    }
    if (typeof parsed.message === 'string') return truncate(parsed.message)
  } catch {
    // 非 JSON 响应，按纯文本处理
  }

  return truncate(trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
}

export function truncate(text: string): string {
  const value = text.trim()
  return value.length > 200 ? `${value.slice(0, 200)}…` : value
}
