// 胶囊标签：承载「上下文」这类可移除的小块信息（当前页面、已绑定文件）。
//
// 与 Badge 的分工：Badge 只读、用于状态；Chip 可交互（点击/移除），
// 所以有 hover、focus 与独立的移除按钮命中区。
//
// 悬浮提示统一用共享 Tooltip（与上下文条一致），只在文字部分挂提示，
// 避免整块胶囊的提示与移除按钮的提示互相叠加。

import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, fontWeight, iconSize, radius, space } from './tokens'
import { Icon, type IconName } from './Icon'
import { Tooltip } from './Tooltip'
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

  // 有 title 时只给文字挂提示：图标与移除按钮各自有自己的提示
  const body = title ? <Tooltip content={title}>{content}</Tooltip> : content

  return (
    <span
      className={cx('ui-chip', className)}
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
          {body}
        </button>
      ) : (
        body
      )}

      {onRemove && removeLabel && (
        // 负边距放在外层：命中区仍是 24×24，Tooltip 包装不参与尺寸计算
        <span
          style={{
            display: 'inline-flex',
            flex: 'none',
            margin: '-6px -6px -6px -2px',
          }}
        >
          <Tooltip content={removeLabel}>
            <button
              type="button"
              onClick={onRemove}
              aria-label={removeLabel}
              className="ui-chip-remove"
              style={{
                width: 24,
                height: 24,
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
          </Tooltip>
        </span>
      )}
    </span>
  )
}
