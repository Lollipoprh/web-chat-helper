// 命令面板：一个输入框 + 可过滤的动作列表，键盘优先。
//
// 动作本身由调用方（App）构造，这里只负责过滤、选中与执行，
// 因此面板不需要知道会话、命令或模型的数据长什么样。

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../shared/useI18n'
import { Dialog, Icon, Input, color, fontSize, radius, space, type IconName } from '../../ui'

export interface PaletteAction {
  id: string
  /** 分组标题，已经本地化 */
  group: string
  label: string
  /** 右侧次要信息，例如会话条数或供应商名 */
  hint?: string
  icon?: IconName
  /** 点击/回车执行；面板会先关闭再执行 */
  run: () => void
}

export interface CommandPaletteProps {
  open: boolean
  actions: PaletteAction[]
  onClose: () => void
}

export function CommandPalette({ open, actions, onClose }: CommandPaletteProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  // 每次打开重置输入与选中项
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
  }, [open])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return actions
    return actions.filter(
      (action) =>
        action.label.toLowerCase().includes(keyword) ||
        (action.hint ?? '').toLowerCase().includes(keyword),
    )
  }, [actions, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  // 键盘移动选中项时把它滚进视野
  useEffect(() => {
    if (!open) return
    document
      .querySelector(`[data-palette-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const run = (action: PaletteAction) => {
    onClose()
    action.run()
  }

  return (
    <Dialog
      open={open}
      title={t('palette.title')}
      closeLabel={t('common.close')}
      onClose={onClose}
      width={460}
    >
      <Input
        autoFocus
        value={query}
        placeholder={t('palette.placeholder')}
        aria-label={t('palette.placeholder')}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)))
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((index) => Math.max(index - 1, 0))
            return
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            const action = filtered[active]
            if (action) run(action)
          }
        }}
      />

      <div
        role="listbox"
        aria-label={t('palette.title')}
        style={{
          marginTop: space.sm,
          maxHeight: '44vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: `${space.md}px ${space.sm}px`, color: color.textFaint }}>
            {t('palette.empty')}
          </div>
        ) : (
          filtered.map((action, index) => {
            const showGroup = index === 0 || filtered[index - 1].group !== action.group
            return (
              <div key={action.id} data-palette-index={index}>
                {showGroup && (
                  <div
                    style={{
                      padding: `${space.sm}px ${space.sm}px 2px`,
                      fontSize: fontSize.xs,
                      color: color.textFaint,
                    }}
                  >
                    {action.group}
                  </div>
                )}
                <div
                  role="option"
                  aria-selected={index === active}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(action)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: space.md,
                    padding: '6px 8px',
                    borderRadius: radius.sm,
                    background: index === active ? color.primarySoft : 'transparent',
                    color: index === active ? color.primarySoftText : color.text,
                    cursor: 'pointer',
                  }}
                >
                  {action.icon && (
                    <Icon
                      name={action.icon}
                      size={14}
                      style={{ color: index === active ? color.primarySoftText : color.textFaint }}
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
                    {action.label}
                  </span>
                  {action.hint && (
                    <span
                      style={{ flex: 'none', fontSize: fontSize.xs, color: color.textFaint }}
                    >
                      {action.hint}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div style={{ marginTop: space.sm, fontSize: fontSize.xs, color: color.textFaint }}>
        {t('palette.footerHint')}
      </div>
    </Dialog>
  )
}
