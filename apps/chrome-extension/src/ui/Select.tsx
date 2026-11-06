import type { CSSProperties, ReactNode, SelectHTMLAttributes } from 'react'
import { color, inputSize, type FieldSize } from './tokens'
import { cx, mergeStyle } from './style'

export interface SelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children'> {
  size?: FieldSize
  block?: boolean
  options: SelectOption[]
}

export function Select({
  size = 'md',
  block = true,
  options,
  style,
  className,
  ...rest
}: SelectProps) {
  const base: CSSProperties = {
    boxSizing: 'border-box',
    width: block ? '100%' : undefined,
    ...inputSize[size],
    border: `1px solid ${color.borderStrong}`,
    background: color.surface,
    color: color.text,
    fontFamily: 'inherit',
    lineHeight: 1.5,
  }

  return (
    <select
      {...rest}
      className={cx('ui-select', className)}
      style={mergeStyle(base, style)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
