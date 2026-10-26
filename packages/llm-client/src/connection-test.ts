// 最小连接测试：发送一条非流式、最小 token 的 Chat Completions 请求
// 只做协议可用性与认证校验，不解析流式响应
// 该模块不依赖 chrome API，便于后续在任意上下文复用

import { extractServerMessage, httpStatusToLLMError } from './errors'

export type ConnectionTestCode =
  | 'ok'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'rate_limit'
  | 'server'
  | 'protocol'

export interface ConnectionTestResult {
  ok: boolean
  code: ConnectionTestCode
  /** 面向用户的中文提示，不含密钥 */
  message: string
  /** HTTP 状态码，网络层失败时为空 */
  status?: number
  durationMs: number
}

export interface ConnectionTestInput {
  /** 已归一化的完整 Chat Completions 地址 */
  chatCompletionsUrl: string
  apiKey: string
  model: string
  /** 外部取消信号，例如用户点击停止 */
  signal?: AbortSignal
  /** 默认 15 秒 */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

export async function testConnection(input: ConnectionTestInput): Promise<ConnectionTestResult> {
  const startedAt = Date.now()
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const onExternalAbort = () => controller.abort()
  input.signal?.addEventListener('abort', onExternalAbort, { once: true })

  const finish = (result: Omit<ConnectionTestResult, 'durationMs'>): ConnectionTestResult => ({
    ...result,
    durationMs: Date.now() - startedAt,
  })

  try {
    const response = await fetch(input.chatCompletionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    })

    const bodyText = await response.text()

    if (!response.ok) {
      const detail = extractServerMessage(bodyText)
      return finish(classifyHttpStatus(response.status, detail))
    }

    // 2xx：还要确认返回体是合法的 Chat Completions 结构
    let payload: unknown
    try {
      payload = JSON.parse(bodyText)
    } catch {
      return finish({
        ok: false,
        code: 'protocol',
        status: response.status,
        message: '接口返回的不是 JSON，可能不是 Chat Completions 兼容服务',
      })
    }

    if (!isChatCompletionPayload(payload)) {
      return finish({
        ok: false,
        code: 'protocol',
        status: response.status,
        message: '返回结构缺少 choices 字段，可能不是 Chat Completions 兼容服务',
      })
    }

    return finish({
      ok: true,
      code: 'ok',
      status: response.status,
      message: `连接成功（${response.status}）`,
    })
  } catch (error) {
    if (timedOut) {
      return finish({
        ok: false,
        code: 'timeout',
        message: `请求超时（超过 ${Math.round(timeoutMs / 1000)} 秒），请检查网络或服务地址`,
      })
    }
    if (controller.signal.aborted) {
      return finish({ ok: false, code: 'aborted', message: '请求已取消' })
    }
    return finish({
      ok: false,
      code: 'network',
      message: `无法连接：${error instanceof Error ? error.message : String(error)}`,
    })
  } finally {
    clearTimeout(timer)
    input.signal?.removeEventListener('abort', onExternalAbort)
  }
}

function classifyHttpStatus(
  status: number,
  detail: string,
): Omit<ConnectionTestResult, 'durationMs'> {
  const error = httpStatusToLLMError(status, detail)
  return { ok: false, code: error.code, status, message: error.message }
}

function isChatCompletionPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const choices = (payload as Record<string, unknown>).choices
  return Array.isArray(choices) && choices.length > 0
}
