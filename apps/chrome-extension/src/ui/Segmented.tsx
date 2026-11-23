// 分段控件：2–3 个互斥选项的紧凑切换器。
//
// 用来替代 composer 里的原生 select：原生下拉在 400px 侧栏里既占宽度、
// 又无法表达「当前是哪种模式」，而且展开的弹层不受主题控制。

import type { CSSProperties } from 'react'
import { color, fontSize, radius, shadow } from './tokens'
import { cx } from './style'

export interface SegmentedOption {
  value: string
  label: string
  title?: string
}

export interface SegmentedProps {
  value: string
  options: SegmentedOption[]
  onChange: (value: string) => void
  /** 控件整体的可访问名称 */
  ariaLabel: string
  disabled?: boolean
  style?: CSSProperties
  className?: string
}

export function Segmented({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  style,
  className,
}: SegmentedProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx('ui-segmented', className)}
      style={{
        display: 'inline-flex',
        flex: 'none',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        boxSizing: 'border-box',
        background: color.surfaceSubtle,
        border: `1px solid ${color.borderMuted}`,
        borderRadius: radius.md,
        ...style,
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            title={option.title}
            onClick={() => {
              if (!active) onChange(option.value)
            }}
            style={{
              padding: '1px 8px',
              border: 'none',
              borderRadius: radius.sm,
              background: active ? color.surface : 'transparent',
              boxShadow: active ? shadow.sm : 'none',
              color: disabled ? color.textFaint : active ? color.text : color.textMuted,
              fontFamily: 'inherit',
              fontSize: fontSize.xs,
              lineHeight: 1.6,
              cursor: disabled ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
