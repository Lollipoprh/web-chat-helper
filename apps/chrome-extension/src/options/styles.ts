// 设置页布局样式：这里只放设置页自身的结构尺寸（侧栏、内容区）。
// 颜色、字号、圆角一律取自 ../ui 的令牌，不要再写色值。

import type { CSSProperties } from 'react'
import { color, fontFamily } from '../ui'

export const shellStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  background: color.page,
  fontFamily,
}

export const sidebarStyle: CSSProperties = {
  width: 220,
  flexShrink: 0,
  padding: '20px 14px',
  background: color.surface,
  borderRight: `1px solid ${color.border}`,
  position: 'sticky',
  top: 0,
  height: '100vh',
  overflowY: 'auto',
  boxSizing: 'border-box',
}

export const sidebarHeaderStyle: CSSProperties = {
  paddingBottom: 12,
  borderBottom: `1px solid ${color.borderMuted}`,
}

export const contentStyle: CSSProperties = {
  flex: 1,
  padding: '32px 24px 72px',
  maxWidth: 880,
  boxSizing: 'border-box',
}
