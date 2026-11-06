// 单条对话消息的气泡。只负责展示，不持有任何业务状态。

import type { CSSProperties } from 'react'
import { color, fontSize, radius } from '../../ui'

export type MessageStatus = 'complete' | 'streaming' | 'error' | 'cancelled'

export interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  status: MessageStatus
  error?: string
}

export function MessageBubble({ role, content, status, error }: MessageBubbleProps) {
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
    <div style={bubble}>
      {content}
      {status === 'streaming' &&
        (content ? (
          <span style={{ color: color.textFaint }}> ▍</span>
        ) : (
          <span style={{ color: color.textFaint }}>正在生成…</span>
        ))}
      {status === 'cancelled' && (
        <span style={{ color: color.textFaint, fontSize: fontSize.xs }}>（已取消）</span>
      )}
      {status === 'error' && (
        <span style={{ color: color.danger, fontSize: fontSize.xs }}>
          {content ? ' ' : ''}
          {error ?? '生成失败'}
        </span>
      )}
    </div>
  )
}
