// 设计令牌：颜色、圆角、字号、间距、控件尺寸、阴影、动效、层级、图标尺寸。
//
// 这里是 UI 的唯一真源。组件内部只引用令牌，不要把色值或尺寸写死在组件里；
// 需要针对单处微调时，由调用方通过组件的 style 参数覆盖。
//
// 颜色为什么是 var() 而不是字面量：内联样式写不了 :hover、媒体查询和主题切换。
// 真实色值（含深色模式）定义在 ./theme.css 的 CSS 变量里，本文件只做引用，
// 因此所有组件的颜色语义保持不变，却同时获得了浅色 / 深色两套主题。

import type { CSSProperties } from 'react'

export const color = {
  text: 'var(--wc-text)',
  textSecondary: 'var(--wc-text-secondary)',
  textMuted: 'var(--wc-text-muted)',
  textFaint: 'var(--wc-text-faint)',
  textBody: 'var(--wc-text-body)',
  textInverse: 'var(--wc-text-inverse)',
  border: 'var(--wc-border)',
  borderMuted: 'var(--wc-border-muted)',
  borderStrong: 'var(--wc-border-strong)',
  surface: 'var(--wc-surface)',
  surfaceMuted: 'var(--wc-surface-muted)',
  surfaceSunken: 'var(--wc-surface-sunken)',
  surfaceSubtle: 'var(--wc-surface-subtle)',
  surfaceDisabled: 'var(--wc-surface-disabled)',
  page: 'var(--wc-bg-page)',
  primary: 'var(--wc-primary)',
  primarySoft: 'var(--wc-primary-soft)',
  primarySoftText: 'var(--wc-primary-soft-text)',
  danger: 'var(--wc-danger)',
  dangerSoft: 'var(--wc-danger-soft)',
  dangerBorder: 'var(--wc-danger-border)',
  dangerBorderStrong: 'var(--wc-danger-border-strong)',
  /** 实心危险按钮底色，与 textInverse 配对 */
  dangerSolid: 'var(--wc-danger-solid)',
  success: 'var(--wc-success)',
  successSoft: 'var(--wc-success-soft)',
  successBorder: 'var(--wc-success-border)',
  successSolid: 'var(--wc-success-solid)',
  warning: 'var(--wc-warning)',
  warningText: 'var(--wc-warning-text)',
  warningSoft: 'var(--wc-warning-soft)',
  warningBorder: 'var(--wc-warning-border)',
  warningSolid: 'var(--wc-warning-solid)',
  infoText: 'var(--wc-info-text)',
  infoSoft: 'var(--wc-info-soft)',
  infoBorder: 'var(--wc-info-border)',
  usageTrack: 'var(--wc-usage-track)',
  usageInput: 'var(--wc-usage-input)',
  usageOutput: 'var(--wc-usage-output)',
  usageFull: 'var(--wc-usage-full)',
  usageGlow: 'var(--wc-usage-glow)',
  usageGlowFull: 'var(--wc-usage-glow-full)',
  /** 拖拽等临时遮罩 */
  overlay: 'var(--wc-overlay)',
  /** 对话框背后的遮罩 */
  scrim: 'var(--wc-scrim)',
  tooltipSurface: 'var(--wc-tooltip-surface)',
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

/** 间距刻度已冻结：新代码请在这套刻度里取值，不要引入 5 / 7 / 9 这类孤立数字。 */
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

/** 阴影随主题变化，所以同样是 CSS 变量 */
export const shadow = {
  sm: 'var(--wc-shadow-sm)',
  md: 'var(--wc-shadow-md)',
  lg: 'var(--wc-shadow-lg)',
} as const

/** 过渡时长与缓动：交互反馈统一 120ms，整块滑入统一 200–240ms */
export const motion = {
  fast: '120ms ease-out',
  base: '200ms ease-out',
  slide: '240ms ease',
} as const

/** 层级刻度，避免各处自造 5 / 10 / 30 / 100 */
export const zIndex = {
  pullTab: 5,
  overlay: 10,
  tooltip: 30,
  popover: 100,
  modal: 200,
} as const

/** 图标尺寸，与 fontSize 分开维护：图标不跟随字号缩放 */
export const iconSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
} as const

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
