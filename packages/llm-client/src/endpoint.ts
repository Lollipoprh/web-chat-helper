// Base URL 规范化与校验
// 用户可能输入三种形式，全部归一化为完整的 Chat Completions 地址：
//   https://api.example.com                    -> https://api.example.com/chat/completions
//   https://api.example.com/v1                 -> https://api.example.com/v1/chat/completions
//   https://api.example.com/v1/chat/completions -> 原样使用
// 注意：这里不硬编码任何厂商域名，所有地址都来自用户输入。

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const CHAT_COMPLETIONS_PATH = '/chat/completions'

export interface EndpointInfo {
  /** 归一化后的完整请求地址 */
  chatCompletionsUrl: string
  /** 站点来源，如 https://api.example.com */
  origin: string
  /** 用于 chrome.permissions 申请的匹配模式，如 https://api.example.com/* */
  originPattern: string
  /** 是否为允许非 HTTPS 的本机地址 */
  isLocal: boolean
}

export type EndpointParseResult =
  | { ok: true; endpoint: EndpointInfo }
  | { ok: false; error: string }

export function parseEndpoint(rawBaseUrl: string): EndpointParseResult {
  const raw = rawBaseUrl.trim()
  if (!raw) {
    return { ok: false, error: '请填写 Base URL' }
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: 'Base URL 不是合法地址，请包含协议，例如 https://api.example.com/v1' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: `不支持的协议 ${url.protocol}，请使用 https://` }
  }

  const isLocal = LOCAL_HOSTNAMES.has(url.hostname.toLowerCase())
  if (url.protocol === 'http:' && !isLocal) {
    return { ok: false, error: '仅支持 HTTPS；本机地址（localhost / 127.0.0.1）可用 HTTP' }
  }

  if (url.username || url.password) {
    return { ok: false, error: 'Base URL 不能内嵌用户名或密码' }
  }

  if (url.search || url.hash) {
    return { ok: false, error: 'Base URL 不能包含查询参数或锚点' }
  }

  const trimmedPath = url.pathname.replace(/\/+$/, '')
  const finalPath = trimmedPath.endsWith(CHAT_COMPLETIONS_PATH)
    ? trimmedPath
    : `${trimmedPath}${CHAT_COMPLETIONS_PATH}`

  return {
    ok: true,
    endpoint: {
      chatCompletionsUrl: `${url.origin}${finalPath}`,
      origin: url.origin,
      originPattern: `${url.protocol}//${url.host}/*`,
      isLocal,
    },
  }
}
