import type {
  CSSProperties,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { color, inputSize, type FieldSize } from './tokens'
import { cx, mergeStyle } from './style'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: FieldSize
  /** 校验失败时的红色边框 */
  invalid?: boolean
  /** 默认占满父容器宽度 */
  block?: boolean
}

function controlBase(
  size: FieldSize,
  invalid: boolean,
  block: boolean,
): CSSProperties {
  return {
    boxSizing: 'border-box',
    width: block ? '100%' : undefined,
    ...inputSize[size],
    border: `1px solid ${invalid ? color.dangerBorderStrong : color.borderStrong}`,
    background: color.surface,
    color: color.text,
    fontFamily: 'inherit',
    lineHeight: 1.5,
  }
}

export function Input({
  size = 'md',
  invalid = false,
  block = true,
  style,
  className,
  ...rest
}: InputProps) {
  return (
    <input
      {...rest}
      className={cx('ui-input', className)}
      style={mergeStyle(controlBase(size, invalid, block), style)}
    />
  )
}

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  size?: FieldSize
  invalid?: boolean
  block?: boolean
  /** 默认禁止手动拖拽缩放 */
  resize?: CSSProperties['resize']
}

export function TextArea({
  size = 'md',
  invalid = false,
  block = true,
  resize = 'none',
  style,
  className,
  ...rest
}: TextAreaProps) {
  const base = mergeStyle(controlBase(size, invalid, block), { resize })
  return (
    <textarea
      {...rest}
      className={cx('ui-textarea', className)}
      style={mergeStyle(base, style)}
    />
  )
}
