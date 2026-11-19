// 通用悬浮框：鼠标悬浮或键盘聚焦时，在触发元素附近展示一块半透明浮层。
// 仅做展示，不依赖 chrome.*，可在任意 UI 中复用。

import { useState, type CSSProperties, type ReactNode } from 'react'
import { color, fontSize, radius } from './tokens'
import { mergeStyle } from './style'

export interface TooltipProps {
  /** 悬浮框内容 */
  content: ReactNode
  /** 触发悬浮框的元素 */
  children: ReactNode
  /** 浮层相对触发元素的位置，默认上方 */
  placement?: 'top' | 'bottom'
  style?: CSSProperties
  className?: string
}

export function Tooltip({
  content,
  children,
  placement = 'top',
  style,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={className}
      style={mergeStyle({ position: 'relative', display: 'block' }, style)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <div
        role="tooltip"
        aria-hidden={!open}
        style={{
          position: 'absolute',
          left: '50%',
          ...(placement === 'top'
            ? { bottom: 'calc(100% + 6px)' }
            : { top: 'calc(100% + 6px)' }),
          transform: `translate(-50%, ${
            open ? '0' : placement === 'top' ? '2px' : '-2px'
          })`,
          width: 'max-content',
          maxWidth: 'min(260px, 70vw)',
          padding: '5px 9px',
          borderRadius: radius.md,
          background: 'rgba(17, 24, 39, 0.82)',
          backdropFilter: 'blur(6px)',
          color: color.textInverse,
          fontSize: fontSize.xs,
          lineHeight: 1.5,
          textAlign: 'center',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.22)',
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          transition: 'opacity 120ms ease, transform 120ms ease',
          pointerEvents: 'none',
          zIndex: 30,
        }}
      >
        {content}
      </div>
    </div>
  )
}
