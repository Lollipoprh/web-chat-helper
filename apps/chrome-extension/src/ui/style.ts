// 组件共用的样式合并规则。
//
// 约定：每个组件先计算自己的默认样式，再把调用方传入的 style 合并到最后，
// 因此 style 中的同名属性一定会覆盖默认值；className 追加在组件自身类名之后。

import type { CSSProperties } from 'react'

export function mergeStyle(
  base: CSSProperties,
  override?: CSSProperties,
): CSSProperties {
  return override ? { ...base, ...override } : base
}

export function cx(...parts: Array<string | false | null | undefined>): string | undefined {
  const value = parts.filter(Boolean).join(' ')
  return value.length > 0 ? value : undefined
}
