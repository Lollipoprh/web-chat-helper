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

  useEffect(() => {
    if (!open) return

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    // 默认聚焦最后一个可聚焦元素：对确认框来说就是主操作按钮
    const panel = panelRef.current
    const items = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
    const target = items.length > 0 ? items[items.length - 1] : panel
    target?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
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
      const active = document.activeElement

      if (event.shiftKey && (active === first || !current.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !current.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      restoreFocusRef.current?.focus()
    }
  }, [open, onClose])

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
            padding: `0 ${space.xl}px ${footer ? space.lg : space.xl}px`,
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
