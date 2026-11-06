import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { buttonSize, color, type ControlSize } from './tokens'
import { cx, mergeStyle } from './style'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'subtle' | 'text'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 视觉语义，默认 secondary */
  variant?: ButtonVariant
  /** xs 行内小操作 / sm 工具栏 / md 表单主操作 */
  size?: ControlSize
  /** 占满父容器宽度 */
  block?: boolean
  /** 加载中：自动禁用，并用 loadingText 替换文案 */
  loading?: boolean
  loadingText?: ReactNode
}

const VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: color.primary,
    color: color.textInverse,
    borderColor: 'transparent',
  },
  secondary: {
    background: color.surface,
    color: color.textSecondary,
    borderColor: color.borderStrong,
  },
  danger: {
    background: color.surface,
    color: color.danger,
    borderColor: color.dangerBorder,
  },
  subtle: {
    background: color.primarySoft,
    color: color.primarySoftText,
    borderColor: 'transparent',
  },
  text: {
    background: 'transparent',
    color: color.text,
    borderColor: 'transparent',
  },
}

const VARIANT_DISABLED_STYLE: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: color.surfaceDisabled,
    color: color.textFaint,
    borderColor: 'transparent',
  },
  secondary: {
    background: color.surface,
    color: color.textFaint,
    borderColor: color.border,
  },
  danger: {
    background: color.surface,
    color: color.textFaint,
    borderColor: color.border,
  },
  subtle: {
    background: color.surfaceSunken,
    color: color.textFaint,
    borderColor: 'transparent',
  },
  text: {
    background: 'transparent',
    color: color.textFaint,
    borderColor: 'transparent',
  },
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  loadingText,
  disabled = false,
  type = 'button',
  style,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  const base: CSSProperties = {
    ...buttonSize[size],
    ...(isDisabled ? VARIANT_DISABLED_STYLE[variant] : VARIANT_STYLE[variant]),
    borderStyle: 'solid',
    borderWidth: 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontWeight: 400,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    width: block ? '100%' : undefined,
  }

  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      className={cx('ui-button', className)}
      style={mergeStyle(base, style)}
    >
      {loading ? (loadingText ?? children) : children}
    </button>
  )
}
