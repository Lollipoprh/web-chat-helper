// 下拉菜单：触发按钮 + 浮层面板。
//
// 侧栏只有 400px 宽，放不下一排并排的会话操作按钮，因此把它们收进菜单。
// 面板用 portal 挂到 body，避免被 footer / 内容区的 overflow 裁切。

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
import { Icon, type IconName } from './Icon'
import { color, fontSize, fontWeight, radius, shadow, space, zIndex } from './tokens'
import { cx } from './style'

export interface DropdownProps {
  /** 触发按钮上的内容 */
  label: ReactNode
  /** 触发按钮的可访问名称 */
  triggerLabel: string
  /** 面板相对触发按钮的对齐方式 */
  align?: 'start' | 'end'
  /** 面板期望宽度；实际会按视口收窄 */
  width?: number
  disabled?: boolean
  triggerStyle?: CSSProperties
  className?: string
  /** 收到 close 以便菜单项点击后自行关闭 */
  children: (close: () => void) => ReactNode
}

export function Dropdown({
  label,
  triggerLabel,
  align = 'start',
  width = 260,
  disabled = false,
  triggerStyle,
  className,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{
    left: number
    top: number
    width: number
    maxHeight: number
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const close = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    if (!open) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const margin = space.md
    const panelWidth = Math.min(width, window.innerWidth - margin * 2)
    const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin)
    const preferred = align === 'end' ? rect.right - panelWidth : rect.left
    const top = rect.bottom + space.xs
    setPos({
      left: Math.min(Math.max(margin, preferred), maxLeft),
      top,
      width: panelWidth,
      // 面板高度按「触发按钮下方剩余空间」给足，避免把底部动作项挤出可视区；
      // 只有视口本身装不下时才会出现面板内滚动。
      maxHeight: Math.max(160, window.innerHeight - top - margin),
    })
  }, [open, align, width])

  // 打开后把焦点移到第一项，键盘用户可以直接回车选择
  useEffect(() => {
    if (!open || !pos) return
    const first = panelRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([disabled])',
    )
    first?.focus()
  }, [open, pos])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }

    function handleDetach(event?: Event) {
      // 面板自身内部的滚动（例如会话很多时滚动列表）不应该关闭菜单
      const target = event?.target
      if (target instanceof Node && panelRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('resize', handleDetach)
    window.addEventListener('scroll', handleDetach, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('resize', handleDetach)
      window.removeEventListener('scroll', handleDetach, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cx('ui-dropdown-trigger', className)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={triggerLabel}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space.xs,
          minWidth: 0,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...triggerStyle,
        }}
      >
        {label}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={triggerLabel}
            className="ui-menu"
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              width: pos.width,
              zIndex: zIndex.popover,
              boxSizing: 'border-box',
              maxHeight: pos.maxHeight,
              overflowY: 'auto',
              padding: space.xs,
              background: color.surface,
              border: `1px solid ${color.border}`,
              borderRadius: radius.lg,
              boxShadow: shadow.md,
            }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  )
}

export interface MenuItemProps {
  icon?: IconName
  label: ReactNode
  /** 右侧的次要信息，例如消息条数 */
  hint?: ReactNode
  tone?: 'default' | 'danger'
  /** 当前项（例如活动会话） */
  selected?: boolean
  disabled?: boolean
  onSelect: () => void
}

export function MenuItem({
  icon,
  label,
  hint,
  tone = 'default',
  selected = false,
  disabled = false,
  onSelect,
}: MenuItemProps) {
  const accent = tone === 'danger' ? color.danger : color.text

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="ui-menu-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.md,
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 8px',
        border: 'none',
        borderRadius: radius.sm,
        background: selected ? color.primarySoft : 'transparent',
        color: disabled ? color.textFaint : selected ? color.primarySoftText : accent,
        fontFamily: 'inherit',
        fontSize: fontSize.md,
        lineHeight: 1.4,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon && (
        <Icon
          name={icon}
          size={14}
          style={{ color: disabled ? color.textFaint : selected ? color.primarySoftText : color.textFaint }}
        />
      )}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {hint !== undefined && (
        <span style={{ flex: 'none', fontSize: fontSize.xs, color: color.textFaint }}>{hint}</span>
      )}
      {selected && <Icon name="check" size={14} style={{ marginLeft: space.xs }} />}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: `4px ${space.md}px`,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.medium,
        color: color.textFaint,
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  )
}

export function MenuSeparator() {
  return (
    <div
      role="separator"
      style={{ height: 1, background: color.borderMuted, margin: `${space.xs}px 0` }}
    />
  )
}
