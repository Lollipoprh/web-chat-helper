// 胶囊标签：承载「上下文」这类可移除的小块信息（当前页面、已绑定文件）。
//
// 与 Badge 的分工：Badge 只读、用于状态；Chip 可交互（点击/移除），
// 所以有 hover、focus 与独立的移除按钮命中区。

import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, fontWeight, iconSize, radius, space } from './tokens'
import { Icon, type IconName } from './Icon'
import { cx } from './style'

export type ChipTone = 'neutral' | 'primary' | 'danger' | 'warning'

export interface ChipProps {
  icon?: IconName
  label: ReactNode
  /** 悬浮提示，通常是完整标题或 URL */
  title?: string
  tone?: ChipTone
  /** 整块可点击（例如去授权） */
  onClick?: () => void
  /** 提供时渲染移除按钮 */
  onRemove?: () => void
  removeLabel?: string
  style?: CSSProperties
  className?: string
}

const TONE: Record<ChipTone, CSSProperties> = {
  neutral: { background: color.surfaceSubtle, color: color.textSecondary },
  primary: { background: color.primarySoft, color: color.primarySoftText },
  danger: { background: color.dangerSoft, color: color.danger },
  warning: { background: color.warningSoft, color: color.warningText },
}

export function Chip({
  icon,
  label,
  title,
  tone = 'neutral',
  onClick,
  onRemove,
  removeLabel,
  style,
  className,
}: ChipProps) {
  const base: CSSProperties = {
    ...TONE[tone],
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.xs,
    flex: 'none',
    maxWidth: 210,
    height: 22,
    boxSizing: 'border-box',
    padding: `0 ${space.sm}px`,
    border: 'none',
    borderRadius: radius.pill,
    fontFamily: 'inherit',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  }

  const content = (
    <>
      {icon && <Icon name={icon} size={iconSize.xs} />}
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </>
  )

  return (
    <span
      className={cx('ui-chip', className)}
      title={title}
      style={{
        ...base,
        ...(onClick ? { cursor: 'pointer' } : null),
        ...style,
      }}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          title={title}
          aria-label={title}
          className="ui-chip-action"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: space.xs,
            minWidth: 0,
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          {content}
        </button>
      ) : (
        content
      )}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="ui-chip-remove"
          style={{
            // 命中区做到 24×24（WCAG 2.5.8），用负边距抵消对胶囊高度的影响
            width: 24,
            height: 24,
            margin: '-6px -6px -6px -2px',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: radius.pill,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            opacity: 0.7,
          }}
        >
          <Icon name="x" size={iconSize.xs} />
        </button>
      )}
    </span>
  )
}
