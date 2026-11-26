// 对话框外壳：遮罩 + 居中面板 + Esc 关闭 + 焦点管理。
//
// 只做展示与焦点逻辑，不关心业务；确认框由 shared/confirm.tsx 组合出来。
// 用 portal 挂到 body，避免被复用容器（如侧栏的 overflow: hidden）裁切。

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './IconButton'
import { color, fontSize, fontWeight, radius, shadow, space, zIndex } from './tokens'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogProps {
  open: boolean
  title?: ReactNode
  children?: ReactNode
  /** 底部操作区，通常是若干按钮（右对齐） */
  footer?: ReactNode
  /** Esc、遮罩点击、关闭按钮都走这里 */
  onClose: () => void
  /** 关闭按钮的可访问名称；不传则不渲染关闭按钮 */
  closeLabel?: string
  /** 面板宽度上限，默认 400 */
  width?: number
  style?: CSSProperties
}

export function Dialog({
  open,
  title,
  children,
  footer,
  onClose,
  closeLabel,
  width = 400,
  style,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // 父组件通常直接传内联箭头函数，每次渲染都是新引用。副作用只跟 open 走，
  // 否则输入框每敲一个字都会重跑一遍：先恢复焦点、再抢到面板里最后一个控件，
  // 表现就是「输入第一个字符就失焦」。
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null

    // 子元素自带 autoFocus（例如重命名输入框）时焦点已在面板内，不要覆盖它
    if (!panel || !active || !panel.contains(active)) {
      restoreFocusRef.current = active
      // 默认聚焦最后一个可聚焦元素：对确认框来说就是主操作按钮
      const items = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
      const target = items.length > 0 ? items[items.length - 1] : panel
      target?.focus()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const current = panelRef.current
      if (!current) return
      const focusable = Array.from(current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const focused = document.activeElement

      if (event.shiftKey && (focused === first || !current.contains(focused))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (focused === last || !current.contains(focused))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      const target = restoreFocusRef.current
      restoreFocusRef.current = null
      if (target?.isConnected) target.focus()
    }
  }, [open])

  if (!open) return null

  const scrim: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: zIndex.modal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    background: color.scrim,
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
  }

  const panel: CSSProperties = {
    width: '100%',
    maxWidth: width,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.xl,
    boxShadow: shadow.lg,
    overflow: 'hidden',
    ...style,
  }

  return createPortal(
    <div
      className="ui-scrim"
      style={scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={panel}
      >
        {(title || closeLabel) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: space.lg,
              padding: `${space.xl}px ${space.xl}px ${space.md}px`,
            }}
          >
            {title && (
              <h2
                id={titleId}
                style={{
                  flex: 1,
                  margin: 0,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: color.text,
                  lineHeight: 1.4,
                }}
              >
                {title}
              </h2>
            )}
            {closeLabel && (
              <IconButton
                icon="x"
                label={closeLabel}
                size="xs"
                onClick={onClose}
                style={{ color: color.textMuted }}
              />
            )}
          </div>
        )}

        <div
          style={{
            // 顶部留出 4px：输入框的焦点环是 3px 的 box-shadow，会被这个滚动容器裁掉上边
            padding: `${space.xs}px ${space.xl}px ${footer ? space.lg : space.xl}px`,
            overflowY: 'auto',
            color: color.textSecondary,
            fontSize: fontSize.md,
            lineHeight: 1.65,
          }}
        >
          {children}
        </div>

        {footer && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: space.md,
              padding: `${space.lg}px ${space.xl}px`,
              borderTop: `1px solid ${color.borderMuted}`,
              background: color.surfaceMuted,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
