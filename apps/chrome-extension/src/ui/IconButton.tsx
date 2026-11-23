// 纯图标按钮：方形命中区，可访问名称必填。
//
// 图标按钮没有可见文字，因此 label 同时用于 aria-label 与 title，
// 保证读屏和鼠标悬浮都能知道按钮作用。命中区最小 24×24（WCAG 2.5.8）。

import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { Button, type ButtonVariant } from './Button'
import { color, radius, type ControlSize } from './tokens'
import { Icon, type IconName } from './Icon'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  icon: IconName
  /** 可访问名称；同时作为 title 与 aria-label */
  label: string
  /** xs 行内（24×24）/ sm 工具栏（26×26）/ md 表单（30×30） */
  size?: ControlSize
  variant?: Extract<ButtonVariant, 'text' | 'secondary' | 'danger' | 'subtle'>
  /** 处于选中/展开状态时提供视觉反馈 */
  active?: boolean
}

const BOX: Record<ControlSize, number> = { xs: 24, sm: 26, md: 30 }

export function IconButton({
  icon,
  label,
  size = 'sm',
  variant = 'text',
  active = false,
  style,
  ...rest
}: IconButtonProps) {
  const box = BOX[size]
  const iconPx = size === 'xs' ? 14 : size === 'sm' ? 15 : 16

  const base: CSSProperties = {
    width: box,
    height: box,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: size === 'md' ? radius.md : radius.sm,
    ...(active
      ? { background: color.primarySoft, color: color.primarySoftText }
      : null),
  }

  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      title={label}
      aria-label={label}
      style={{ ...base, ...style }}
    >
      <Icon name={icon} size={iconPx} />
    </Button>
  )
}
