// 会话菜单内容：搜索框 + 会话列表 + 新建/重命名/清空/删除/任务记录。
//
// 从 App.tsx 里拆出来，一是因为搜索词属于「菜单自己」的临时状态，
// 二是因为菜单结构后续还会长（分组、置顶），留在 App 里会继续膨胀。

import { useMemo, useState } from 'react'
import type { SessionRecord } from '../../shared/session-storage'
import { useI18n } from '../../shared/useI18n'
import { Input, MenuItem, MenuLabel, MenuSeparator, color, fontSize, space } from '../../ui'

/** 超过这个数量才显示搜索框，少量会话时保持菜单干净 */
const SEARCH_THRESHOLD = 4

export interface SessionMenuProps {
  sessions: SessionRecord[]
  activeSessionId: string | null
  generating: boolean
  onSwitch: (sessionId: string) => void
  onNew: () => void
  onRename: () => void
  onClear: () => void
  onDelete: () => void
  onShowTasks: () => void
  /** 关闭整个下拉菜单 */
  close: () => void
}

export function SessionMenu({
  sessions,
  activeSessionId,
  generating,
  onSwitch,
  onNew,
  onRename,
  onClear,
  onDelete,
  onShowTasks,
  close,
}: SessionMenuProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return sessions
    return sessions.filter((session) => session.title.toLowerCase().includes(keyword))
  }, [sessions, query])

  const run = (action: () => void) => {
    close()
    action()
  }

  return (
    <>
      {sessions.length > SEARCH_THRESHOLD && (
        <div style={{ padding: `0 ${space.xs}px ${space.xs}px` }}>
          <Input
            type="search"
            size="sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('sidepanel.sessionSearch')}
            aria-label={t('sidepanel.sessionSearch')}
          />
        </div>
      )}

      <MenuLabel>{t('sidepanel.sessionsTitle')}</MenuLabel>

      {sessions.length === 0 ? (
        <MenuItem label={t('sidepanel.noSession')} disabled onSelect={() => undefined} />
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: `${space.sm}px ${space.md}px`,
            color: color.textFaint,
            fontSize: fontSize.sm,
          }}
        >
          {t('sidepanel.sessionNoMatch')}
        </div>
      ) : (
        // 会话多时只让列表滚动，下方动作项保持可见
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {filtered.map((session) => (
            <MenuItem
              key={session.sessionId}
              label={session.title || t('sidepanel.noSession')}
              hint={session.messageCount}
              selected={session.sessionId === activeSessionId}
              disabled={generating}
              onSelect={() => run(() => onSwitch(session.sessionId))}
            />
          ))}
        </div>
      )}

      <MenuSeparator />
      <MenuItem icon="plus" label={t('sidepanel.newSession')} disabled={generating} onSelect={() => run(onNew)} />
      <MenuItem
        icon="pencil"
        label={t('sidepanel.renameSession')}
        disabled={generating || !activeSessionId}
        onSelect={() => run(onRename)}
      />
      <MenuItem
        icon="eraser"
        label={t('sidepanel.clearChatAction')}
        disabled={generating || !activeSessionId}
        onSelect={() => run(onClear)}
      />
      <MenuItem
        icon="trash"
        tone="danger"
        label={t('sidepanel.deleteSessionAction')}
        disabled={generating || !activeSessionId}
        onSelect={() => run(onDelete)}
      />
      <MenuSeparator />
      <MenuItem
        icon="list"
        label={t('sidepanel.tasks')}
        disabled={!activeSessionId}
        onSelect={() => run(onShowTasks)}
      />
    </>
  )
}
