// 工具调用事件卡片：默认收起显示名称/状态/耗时，点击展开参数与结果摘要。

import type { AgentToolEvent } from 'agent-core'
import { useI18n } from '../../shared/useI18n'
import type { MessageKey } from '../../shared/i18n'
import { Button, color, fontSize, radius, space } from '../../ui'

const STATUS_META: Record<
  AgentToolEvent['status'],
  { labelKey: MessageKey; color: string }
> = {
  running: { labelKey: 'tool.running', color: color.textFaint },
  awaiting_confirmation: { labelKey: 'tool.awaitingConfirmation', color: color.warning },
  success: { labelKey: 'tool.success', color: color.success },
  error: { labelKey: 'tool.error', color: color.danger },
}

export interface ToolEventItemProps {
  event: AgentToolEvent
  expanded: boolean
  onToggle: () => void
}

export function ToolEventItem({ event, expanded, onToggle }: ToolEventItemProps) {
  const { t } = useI18n()
  const meta = STATUS_META[event.status]

  return (
    <div
      style={{
        fontSize: fontSize.xs,
        color: color.textBody,
        background: color.surfaceSunken,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
      }}
    >
      <Button
        variant="text"
        block
        onClick={onToggle}
        style={{
          textAlign: 'left',
          padding: '6px 10px',
          border: 'none',
          borderRadius: radius.md,
          display: 'flex',
          alignItems: 'center',
          gap: space.sm,
          fontSize: 'inherit',
          whiteSpace: 'normal',
          color: 'inherit',
        }}
      >
        <span style={{ color: color.textFaint }}>{expanded ? '▾' : '▸'}</span>
        <span style={{ fontFamily: 'monospace' }}>{event.name}</span>
        <span style={{ color: meta.color, fontWeight: 500 }}>{t(meta.labelKey)}</span>
        {typeof event.durationMs === 'number' && (
          <span style={{ color: color.textFaint }}>{event.durationMs}ms</span>
        )}
      </Button>

      {expanded && (
        <div
          style={{
            padding: '0 10px 8px 26px',
            display: 'flex',
            flexDirection: 'column',
            gap: space.xs,
          }}
        >
          {event.argsPreview && (
            <div style={{ color: color.textMuted, wordBreak: 'break-all', fontSize: fontSize.xs }}>
              {event.argsPreview}
            </div>
          )}
          {event.summary && (
            <div
              style={{
                color: event.status === 'error' ? color.danger : color.textSecondary,
                fontSize: fontSize.xs,
                lineHeight: 1.55,
              }}
            >
              {event.summary}
            </div>
          )}
          {event.errorCode && (
            <div style={{ color: color.danger, fontSize: fontSize.xs }}>
              {t('tool.errorCode', { code: event.errorCode })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
