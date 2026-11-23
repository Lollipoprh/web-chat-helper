// 加载指示器：一个纯 CSS 旋转圆环。
//
// 动画与配色都在 theme.css（.ui-spinner），这样能复用 keyframes 并遵循
// prefers-reduced-motion。组件只负责尺寸；可访问性由调用方的文字承担，
// 因此这里固定 aria-hidden，避免读屏重复播报。

import type { CSSProperties } from 'react'
import { color, fontSize, space } from './tokens'
import { cx } from './style'

export interface SpinnerProps {
  /** 直径，默认 14 */
  size?: number
  style?: CSSProperties
  className?: string
}

export function Spinner({ size = 14, style, className }: SpinnerProps) {
  return (
    <span
      className={cx('ui-spinner', className)}
      aria-hidden="true"
      style={{ width: size, height: size, ...style }}
    />
  )
}

export interface LoadingRowProps {
  /** 与 Spinner 并排的说明文字 */
  label: string
  size?: number
  style?: CSSProperties
}

/** 「转圈 + 文案」的常用组合，避免各处各写一套加载行 */
export function LoadingRow({ label, size = 14, style }: LoadingRowProps) {
  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: space.md,
    color: color.textMuted,
    fontSize: fontSize.sm,
  }

  return (
    <div style={{ ...base, ...style }}>
      <Spinner size={size} />
      <span>{label}</span>
    </div>
  )
}
