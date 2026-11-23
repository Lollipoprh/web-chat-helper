// 单条对话消息的气泡。只负责展示，不持有任何业务状态。

import type { CSSProperties } from 'react'
import { useI18n } from '../../shared/useI18n'
import { color, fontSize, radius } from '../../ui'

export type MessageStatus = 'complete' | 'streaming' | 'error' | 'cancelled'

export interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  status: MessageStatus
  error?: string
}

export function MessageBubble({ role, content, status, error }: MessageBubbleProps) {
  const { t } = useI18n()
  const isUser = role === 'user'
  const isError = !isUser && status === 'error'

  const bubble: CSSProperties = {
    maxWidth: '88%',
    padding: '8px 11px',
    borderRadius: radius.lg,
    fontSize: fontSize.md,
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: isUser ? color.primary : isError ? color.dangerSoft : color.surfaceSubtle,
    color: isUser ? color.textInverse : color.text,
    border: isError ? `1px solid ${color.dangerBorder}` : 'none',
  }

  return (
    <div
      style={bubble}
      // 流式回复持续追加文本：声明为 polite 区域，读屏会在停顿处播报增量
      aria-live={status === 'streaming' ? 'polite' : undefined}
      aria-busy={status === 'streaming' ? true : undefined}
    >
      {content}
      {status === 'streaming' &&
        (content ? (
          <span aria-hidden="true" style={{ color: color.textFaint }}>
            {' '}
            ▍
          </span>
        ) : (
          <span style={{ color: color.textFaint }}>{t('message.generating')}</span>
        ))}
      {status === 'cancelled' && (
        <span style={{ color: color.textFaint, fontSize: fontSize.xs }}>
          {t('message.cancelled')}
        </span>
      )}
      {status === 'error' && (
        <span style={{ color: color.danger, fontSize: fontSize.xs }}>
          {content ? ' ' : ''}
          {error ?? t('message.failed')}
        </span>
      )}
    </div>
  )
}
