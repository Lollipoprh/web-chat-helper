import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import type { ProviderConfig } from 'llm-client'
import { color, fontSize, radius, space } from '../../ui'

interface ModelGroup {
  providerName: string
  models: ProviderConfig[]
}

interface AnchorRect {
  left: number
  width: number
  /** 相对视口底部的偏移，用于把面板贴在触发按钮上方 */
  bottom: number
}

export interface ModelPickerProps {
  providers: ProviderConfig[]
  value: string
  disabled?: boolean
  onChange: (id: string) => void
}

const TRIGGER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  boxSizing: 'border-box',
  border: 'none',
  outline: 'none',
  background: color.surfaceSubtle,
  borderRadius: radius.sm,
  padding: '4px 8px',
  fontSize: fontSize.sm,
  fontFamily: 'inherit',
  lineHeight: 1.5,
  textAlign: 'left',
  overflow: 'hidden',
}

/**
 * 底部输入区的模型选择器。
 * 触发按钮无边框、无展开箭头、浅灰底色；点击后向上弹出。
 * 选项为「供应商 → 模型」二级数组，全部展开，仅模型可点选。
 */
export function ModelPicker({
  providers,
  value,
  disabled = false,
  onChange,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<AnchorRect | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // 二级数组：一级是供应商分组，二级是该供应商下的模型，渲染时全部展开
  const groups = useMemo<ModelGroup[]>(() => {
    const map = new Map<string, ProviderConfig[]>()
    for (const item of providers) {
      const key = item.name.trim() || '未命名供应商'
      const existing = map.get(key)
      if (existing) existing.push(item)
      else map.set(key, [item])
    }
    return Array.from(map, ([providerName, models]) => ({ providerName, models }))
  }, [providers])

  const selected = providers.find((item) => item.id === value) ?? null

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    function close() {
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  function toggle() {
    if (disabled) return
    if (open) {
      setOpen(false)
      return
    }

    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setAnchor({
      left: rect.left,
      width: rect.width,
      bottom: window.innerHeight - rect.top + space.xs,
    })
    setOpen(true)
  }

  function select(id: string) {
    onChange(id)
    setOpen(false)
  }

  const panelStyle: CSSProperties | null =
    open && anchor
      ? {
          position: 'fixed',
          left: anchor.left,
          bottom: anchor.bottom,
          width: anchor.width,
          zIndex: 100,
          boxSizing: 'border-box',
          maxHeight: 260,
          overflowY: 'auto',
          padding: space.xs,
          background: color.surfaceMuted,
          border: `1px solid ${color.border}`,
          borderRadius: radius.md,
          boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.12)',
        }
      : null

  return (
    <div style={{ flex: '0 1 33%', minWidth: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={selected ? `${selected.name} · ${selected.model}` : '切换供应商模型'}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          ...TRIGGER_STYLE,
          color: disabled ? color.textFaint : color.textSecondary,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selected?.model ?? '选择模型'}
        </span>
      </button>

      {panelStyle &&
        createPortal(
          <div ref={panelRef} role="listbox" style={panelStyle}>
            {groups.map((group) => (
              <div key={group.providerName} style={{ padding: `${space.xs}px 0` }}>
                <div
                  style={{
                    padding: `2px ${space.md}px`,
                    fontSize: fontSize.xs,
                    color: color.textFaint,
                    userSelect: 'none',
                  }}
                >
                  {group.providerName}
                </div>
                {group.models.map((item) => {
                  const isSelected = item.id === value
                  const isHovered = item.id === hoveredId
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => select(item.id)}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        border: 'none',
                        borderRadius: radius.sm,
                        padding: '5px 8px',
                        background:
                          isSelected || isHovered ? color.surface : 'transparent',
                        color: isSelected ? color.primarySoftText : color.text,
                        fontWeight: isSelected ? 500 : 400,
                        fontSize: fontSize.sm,
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                        textAlign: 'left',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.model}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
