// 通用悬浮框：鼠标悬浮或键盘聚焦时，在触发元素附近展示一块浮层。
//
// 两种实现方式都用过，这里选 portal + fixed：
// 1) 原先的 absolute 定位在侧栏里会被祖先的 overflow（例如上下文条的横向滚动）
//    裁掉，浮层只露一条边；
// 2) 浮层内容较宽时，靠近右边缘的触发元素会把文字顶出视口。
// 因此浮层挂到 body 上，并根据触发元素的位置和自身尺寸做视口收窄。

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { color, fontSize, radius, shadow, zIndex } from './tokens'
import { mergeStyle } from './style'

/** 浮层与视口边缘的最小间距 */
const EDGE_GAP = 8
/** 浮层与触发元素之间的间距 */
const OFFSET = 6

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
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)

  // 浮层常驻 DOM（只是不可见），这样打开前就能量到真实尺寸，避免先闪一下再归位
  const measure = useCallback(() => {
    const anchor = anchorRef.current
    const bubble = bubbleRef.current
    if (!anchor || !bubble) return

    const rect = anchor.getBoundingClientRect()
    const width = bubble.offsetWidth
    const height = bubble.offsetHeight
    const viewportWidth = document.documentElement.clientWidth

    const centered = rect.left + rect.width / 2 - width / 2
    const maxLeft = Math.max(EDGE_GAP, viewportWidth - width - EDGE_GAP)
    const left = Math.min(Math.max(centered, EDGE_GAP), maxLeft)
    const top = placement === 'top' ? rect.top - height - OFFSET : rect.bottom + OFFSET

    setPosition({ left, top: Math.max(EDGE_GAP, top) })
  }, [placement])

  useLayoutEffect(() => {
    measure()
  }, [measure, content])

  useEffect(() => {
    if (!open) return
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  return (
    <>
      <div
        ref={anchorRef}
        className={className}
        style={mergeStyle({ position: 'relative', display: 'block' }, style)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </div>

      {createPortal(
        <div
          ref={bubbleRef}
          role="tooltip"
          aria-hidden={!open}
          style={{
            position: 'fixed',
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            // 打开前保持不可见但仍参与布局，便于测量宽度
            visibility: open && position ? 'visible' : 'hidden',
            opacity: open ? 1 : 0,
            width: 'max-content',
            maxWidth: `min(260px, calc(100vw - ${EDGE_GAP * 2}px))`,
            padding: '5px 9px',
            borderRadius: radius.md,
            background: color.tooltipSurface,
            backdropFilter: 'blur(6px)',
            color: color.textInverse,
            fontSize: fontSize.xs,
            lineHeight: 1.5,
            textAlign: 'center',
            whiteSpace: 'normal',
            boxShadow: shadow.md,
            transition: 'opacity 120ms ease',
            pointerEvents: 'none',
            zIndex: zIndex.tooltip,
            boxSizing: 'border-box',
          }}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  )
}
