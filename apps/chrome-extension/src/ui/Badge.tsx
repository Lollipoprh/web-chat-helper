import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, radius, space } from './tokens'
import { cx, mergeStyle } from './style'

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  style?: CSSProperties
  className?: string
}

const TONE_STYLE: Record<BadgeTone, CSSProperties> = {
  primary: { background: color.primarySoft, color: color.primarySoftText },
  success: { background: color.successSoft, color: color.success },
  warning: { background: color.warningSoft, color: color.warningText },
  danger: { background: color.dangerSoft, color: color.danger },
  neutral: { background: color.surfaceDisabled, color: color.textSecondary },
}

export function Badge({ tone = 'primary', children, style, className }: BadgeProps) {
  const base: CSSProperties = {
    ...TONE_STYLE[tone],
    display: 'inline-block',
    padding: '1px 8px',
    fontSize: fontSize.xs,
    lineHeight: 1.6,
    borderRadius: radius.pill,
    marginLeft: space.md,
  }

  return (
    <span className={cx('ui-badge', className)} style={mergeStyle(base, style)}>
      {children}
    </span>
  )
}
