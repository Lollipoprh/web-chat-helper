// 站点权限申请封装
// https 站点已由 manifest 的 host_permissions 全量授权；
// 本机 http 地址声明在 optional_host_permissions 中，只在用户主动操作（点击按钮）时申请。

/**
 * 判断 match pattern 是否为 https 站点。
 * 这类站点由必选 host_permissions 覆盖，无需再走权限申请流程。
 */
export function isHttpsOriginPattern(originPattern: string): boolean {
  return originPattern.startsWith('https://')
}

/**
 * 由页面 URL 推导 match pattern。
 * 只接受 http/https；受保护页面（chrome://、扩展页等）返回 null。
 * 注意 match pattern 不支持端口，因此只取 hostname。
 */
export function originPatternFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}/*`
  } catch {
    return null
  }
}

/**
 * 只有本机 http 地址仍声明在 optional_host_permissions 中，可以按需申请；
 * 其他 http 站点无法申请，也就不参与权限请求。
 */
export function isRequestableOriginPattern(originPattern: string): boolean {
  return (
    /^https:\/\/[^/]+\/\*$/.test(originPattern) ||
    /^http:\/\/(localhost|127\.0\.0\.1)\/\*$/.test(originPattern)
  )
}

/**
 * 申请一批站点的访问权限。
 * 必须在用户手势（点击事件）的调用链中执行；调用前不要 await 其他 API，
 * 否则 Chrome 可能判定手势已失效。已授权的地址会直接返回 true，不弹窗。
 */
export async function requestOriginPermissions(originPatterns: string[]): Promise<boolean> {
  const origins = [
    ...new Set(originPatterns.filter((pattern) => isRequestableOriginPattern(pattern))),
  ]
  if (origins.length === 0) return true
  try {
    return await chrome.permissions.request({ origins })
  } catch (error) {
    console.warn('[permissions] 权限申请失败:', error)
    return false
  }
}

/**
 * 申请单个站点的访问权限。
 * 同上：必须紧贴用户手势，申请前不要 await 其他 API。
 */
export async function requestOriginPermission(originPattern: string): Promise<boolean> {
  return requestOriginPermissions([originPattern])
}
