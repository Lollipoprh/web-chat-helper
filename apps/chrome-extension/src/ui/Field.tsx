import {
  cloneElement,
  isValidElement,
  useId,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { color, fontSize, space } from './tokens'
import { mergeStyle } from './style'

export interface FieldProps {
  /** 字段标题 */
  label: ReactNode
  /**
   * 关联控件的 id。省略时自动生成，并注入到唯一的子控件上；
   * 传入时由调用方保证控件自身带有同一 id。
   */
  htmlFor?: string
  /** 控制下方的说明文字 */
  hint?: ReactNode
  /** 校验错误；存在时同时显示红色提示与 aria-invalid */
  error?: string | null
  required?: boolean
  children: ReactNode
  style?: CSSProperties
  labelStyle?: CSSProperties
}

const labelBase: CSSProperties = {
  display: 'block',
  fontSize: fontSize.md,
  fontWeight: 500,
  color: color.textSecondary,
  marginBottom: space.sm,
}

const hintBase: CSSProperties = {
  margin: '6px 0 0',
  fontSize: fontSize.sm,
  color: color.textMuted,
  lineHeight: 1.6,
}

const errorBase: CSSProperties = {
  margin: '6px 0 0',
  fontSize: fontSize.sm,
  color: color.danger,
  lineHeight: 1.6,
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  style,
  labelStyle,
}: FieldProps) {
  const autoId = useId()
  const id = htmlFor ?? autoId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const canBind = !htmlFor && isValidElement(children)
  const control = canBind
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children

  return (
    <div style={mergeStyle({ marginBottom: space.xl }, style)}>
      <label htmlFor={id} style={mergeStyle(labelBase, labelStyle)}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: color.danger, marginLeft: 2 }}>
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} style={hintBase}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} style={errorBase}>
          {error}
        </p>
      )}
    </div>
  )
}
