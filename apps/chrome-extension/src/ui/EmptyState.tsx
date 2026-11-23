// 空状态：图标 + 标题 + 说明 + 可选操作。
//
// 之前三处空状态各自手写（纯灰字、居中块、无操作入口），
// 统一到这里后外观一致，也给首屏留出了引导空间。

import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, fontWeight, iconSize, radius, space } from './tokens'
import { Icon, type IconName } from './Icon'
import { cx } from './style'

/** 图标底圈直径：介于 iconSize 与控件尺寸之间，没有对应刻度，单独命名 */
const ICON_CIRCLE = 40
/** 说明文字最大宽度，保证侧栏内一行不会过长 */
const DESCRIPTION_MAX_WIDTH = 260

export interface EmptyStateProps {
  icon?: IconName
  title?: ReactNode
  description?: ReactNode
  /** 主要操作，例如「打开设置」 */
  action?: ReactNode
  /** 紧凑模式：用于侧栏内的列表区域，去掉大留白与图标底圈 */
  compact?: boolean
  style?: CSSProperties
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  style,
  className,
}: EmptyStateProps) {
  const base: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: compact ? space.sm : space.md,
    padding: compact ? `${space.xl}px ${space.lg}px` : `${space.xxl}px ${space.xl}px`,
    color: color.textMuted,
  }

  return (
    <div className={cx('ui-empty-state', className)} style={{ ...base, ...style }}>
      {icon && !compact && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: ICON_CIRCLE,
            height: ICON_CIRCLE,
            borderRadius: radius.pill,
            background: color.surfaceSubtle,
            color: color.textFaint,
          }}
        >
          <Icon name={icon} size={iconSize.lg} strokeWidth={1.5} />
        </span>
      )}
      {title && (
        <div
          style={{
            fontSize: compact ? fontSize.sm : fontSize.md,
            fontWeight: fontWeight.medium,
            color: color.textSecondary,
            lineHeight: 1.4,
          }}
        >
          {title}
        </div>
      )}
      {description && (
        <div
          style={{
            fontSize: fontSize.sm,
            lineHeight: 1.6,
            maxWidth: DESCRIPTION_MAX_WIDTH,
          }}
        >
          {description}
        </div>
      )}
      {action}
    </div>
  )
}
