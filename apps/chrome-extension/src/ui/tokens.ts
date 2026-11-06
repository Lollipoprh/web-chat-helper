// 设计令牌：颜色、圆角、字号、间距、控件尺寸。
// 这里是 UI 的唯一真源。组件内部只引用令牌，不要把色值或尺寸写死在组件里；
// 需要针对单处微调时，由调用方通过组件的 style 参数覆盖。

import type { CSSProperties } from 'react'

export const color = {
  text: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  textBody: '#4b5563',
  textInverse: '#ffffff',
  border: '#e5e7eb',
  borderMuted: '#f3f4f6',
  borderStrong: '#d1d5db',
  surface: '#ffffff',
  surfaceMuted: '#fafafa',
  surfaceSunken: '#f9fafb',
  surfaceSubtle: '#f3f4f6',
  surfaceDisabled: '#e5e7eb',
  page: '#fafafa',
  primary: '#2563eb',
  primarySoft: '#eff6ff',
  primarySoftText: '#1d4ed8',
  danger: '#b91c1c',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  dangerBorderStrong: '#fca5a5',
  success: '#047857',
  successSoft: '#ecfdf5',
  successBorder: '#a7f3d0',
  warning: '#d97706',
  warningText: '#9a3412',
  warningSoft: '#fff7ed',
  warningBorder: '#fed7aa',
  infoText: '#0c4a6e',
  infoSoft: '#f0f9ff',
  infoBorder: '#bae6fd',
} as const

export const radius = {
  xs: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  pill: 999,
} as const

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  lg: 14,
  xl: 22,
} as const

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
} as const

export const space = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const

export const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export type ControlSize = 'xs' | 'sm' | 'md'
export type FieldSize = 'sm' | 'md'

/** 按钮尺寸：xs（行内小操作）/ sm（工具栏）/ md（表单主操作）。 */
export const buttonSize: Record<ControlSize, CSSProperties> = {
  xs: { padding: '2px 8px', fontSize: fontSize.xs, borderRadius: radius.sm },
  sm: { padding: '3px 10px', fontSize: fontSize.sm, borderRadius: radius.sm },
  md: { padding: '7px 14px', fontSize: fontSize.md, borderRadius: radius.md },
}

/** 输入类控件尺寸，与 buttons 分开维护，避免互相牵连。 */
export const inputSize: Record<FieldSize, CSSProperties> = {
  sm: { padding: '4px 8px', fontSize: fontSize.sm, borderRadius: radius.sm },
  md: { padding: '8px 10px', fontSize: fontSize.md, borderRadius: radius.md },
}
