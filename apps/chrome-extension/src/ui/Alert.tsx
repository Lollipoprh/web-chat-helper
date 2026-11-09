import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, radius } from './tokens'
import { cx, mergeStyle } from './style'

export type AlertTone = 'error' | 'warning' | 'success' | 'info'

export interface AlertProps {
  /** 语义色，默认 error */
  tone?: AlertTone
  /** 通栏提示条：去掉左右上边框与圆角，仅保留底边框 */
  flush?: boolean
  children: ReactNode
  style?: CSSProperties
  className?: string
}

const TONE_STYLE: Record<AlertTone, CSSProperties> = {
  error: {
    background: color.dangerSoft,
    color: color.danger,
    borderColor: color.dangerBorder,
  },
  warning: {
    background: color.warningSoft,
    color: color.warningText,
    borderColor: color.warningBorder,
  },
  success: {
    background: color.successSoft,
    color: color.success,
    borderColor: color.successBorder,
  },
  info: {
    background: color.infoSoft,
    color: color.infoText,
    borderColor: color.infoBorder,
  },
}

export function Alert({
  tone = 'error',
  flush = false,
  children,
  style,
  className,
}: AlertProps) {
  const base: CSSProperties = {
    ...TONE_STYLE[tone],
    padding: '10px 12px',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: radius.md,
    fontSize: fontSize.sm,
    lineHeight: 1.6,
    wordBreak: 'break-word',
    ...(flush
      ? {
          borderRadius: 0,
          borderTopWidth: 0,
          borderLeftWidth: 0,
          borderRightWidth: 0,
        }
      : null),
  }

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('ui-alert', className)}
      style={mergeStyle(base, style)}
    >
      {children}
    </div>
  )
}
