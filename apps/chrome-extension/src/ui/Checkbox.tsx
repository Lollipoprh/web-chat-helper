import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react'
import { color, fontSize, space } from './tokens'
import { cx, mergeStyle } from './style'

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: ReactNode
  /** sm 用于侧边栏等紧凑区域，md 用于设置页表单 */
  size?: 'sm' | 'md'
  labelStyle?: CSSProperties
}

export function Checkbox({
  label,
  size = 'md',
  labelStyle,
  style,
  className,
  ...rest
}: CheckboxProps) {
  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    fontSize: size === 'sm' ? fontSize.xs : fontSize.md,
    cursor: 'pointer',
    userSelect: 'none',
  }

  return (
    <label className={cx('ui-checkbox', className)} style={mergeStyle(base, style)}>
      <input
        {...rest}
        type="checkbox"
        style={{ margin: 0, cursor: 'pointer', accentColor: color.primary }}
      />
      <span style={labelStyle}>{label}</span>
    </label>
  )
}
