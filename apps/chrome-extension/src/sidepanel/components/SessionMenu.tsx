// 会话列表：搜索框 + 每一行「切过去 / 删除」。
//
// 动作项（新建、重命名、删除当前会话）已经上移到标题栏，清空与任务记录入口移除
// （清空仍可用 /clear，任务记录用右侧滑出按钮），菜单只负责切换与逐条删除。

import { useMemo, useState } from 'react'
import type { SessionRecord } from '../../shared/session-storage'
import { useI18n } from '../../shared/useI18n'
import { Icon, IconButton, Input, color, fontSize, radius, space } from '../../ui'

/** 超过这个数量才显示搜索框，少量会话时保持菜单干净 */
const SEARCH_THRESHOLD = 4

export interface SessionMenuProps {
  sessions: SessionRecord[]
  activeSessionId: string | null
  generating: boolean
  onSwitch: (sessionId: string) => void
  onDelete: (sessionId: string) => void
  /** 关闭整个下拉菜单 */
  close: () => void
}

export function SessionMenu({
  sessions,
  activeSessionId,
  generating,
  onSwitch,
  onDelete,
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
        <div style={{ padding: space.xs }}>
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

      {sessions.length === 0 ? (
        <div
          style={{
            padding: `${space.sm}px ${space.md}px`,
            color: color.textFaint,
            fontSize: fontSize.sm,
          }}
        >
          {t('sidepanel.noSession')}
        </div>
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 240,
            overflowY: 'auto',
            gap: 1,
          }}
        >
          {filtered.map((session) => {
            const active = session.sessionId === activeSessionId
            return (
              <div
                key={session.sessionId}
                className="ui-session-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space.xs,
                  borderRadius: radius.sm,
                  background: active ? color.primarySoft : 'transparent',
                }}
              >
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => run(() => onSwitch(session.sessionId))}
                  title={session.title}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: space.md,
                    padding: '5px 4px 5px 8px',
                    border: 'none',
                    background: 'transparent',
                    color: active ? color.primarySoftText : color.text,
                    fontFamily: 'inherit',
                    fontSize: fontSize.md,
                    lineHeight: 1.4,
                    textAlign: 'left',
                    cursor: generating ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {session.title || t('sidepanel.noSession')}
                  </span>
                  <span style={{ flex: 'none', fontSize: fontSize.xs, color: color.textFaint }}>
                    {session.messageCount}
                  </span>
                  {active && <Icon name="check" size={14} style={{ flex: 'none' }} />}
                </button>
                <IconButton
                  icon="trash"
                  size="xs"
                  label={t('sidepanel.deleteSessionRow')}
                  disabled={generating}
                  onClick={() => run(() => onDelete(session.sessionId))}
                  style={{ background: 'transparent', color: color.textFaint, marginRight: 2 }}
                />
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
