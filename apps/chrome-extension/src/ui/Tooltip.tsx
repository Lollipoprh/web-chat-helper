// 通用悬浮提示：鼠标悬浮或键盘聚焦时，在触发元素附近展示一条说明。
//
// 为什么不是原生 title：
// 1. 原生提示由系统绘制，浅色/深色都无法跟随主题，和上下文条的提示风格不一致；
// 2. 原生提示延迟约 1 秒且不能换行排版，长文案（完整会话名、模型说明）体验很差。
//
// 实现要点：
// - 浮层 portal 到 body 并绝对定位于视口，因此不会被祖先的 overflow 裁剪；
// - 打开时才挂载浮层，页面里有几十个图标按钮也不会产生几十个隐藏节点；
// - 水平位置按自身宽度收窄到视口内，靠近右边缘的触发元素不会把文字顶出去。

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
  /** 悬浮提示内容 */
  content: ReactNode
  /** 触发悬浮提示的元素 */
  children: ReactNode
  /** 浮层相对触发元素的位置，默认上方 */
  placement?: 'top' | 'bottom'
  /** 触发元素容器的额外样式（默认 inline-flex，便于放在按钮或文字旁） */
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
  // 首次打开才挂载浮层：长列表里每个按钮都带提示时不至于堆一堆隐藏节点
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)

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
    if (!open || !mounted) return
    measure()
  }, [open, mounted, measure, content])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  const show = () => {
    setMounted(true)
    setOpen(true)
  }

  return (
    <>
      <span
        ref={anchorRef}
        className={className}
        style={mergeStyle({ position: 'relative', display: 'inline-flex', maxWidth: '100%' }, style)}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>

      {mounted &&
        createPortal(
          <div
            ref={bubbleRef}
            role="tooltip"
            aria-hidden={!open}
            style={{
              position: 'fixed',
              left: position?.left ?? 0,
              top: position?.top ?? 0,
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
