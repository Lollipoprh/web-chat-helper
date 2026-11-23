// 单条对话消息的气泡 + 悬浮动作。只负责展示，不持有任何业务状态。

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '../../shared/useI18n'
import { IconButton, color, fontSize, radius, space } from '../../ui'

export type MessageStatus = 'complete' | 'streaming' | 'error' | 'cancelled'

export interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  status: MessageStatus
  error?: string
  /** 用户消息：把内容放回输入框继续编辑（不删除历史） */
  onEdit?: (content: string) => void
}

export function MessageBubble({
  role,
  content,
  status,
  error,
  onEdit,
}: MessageBubbleProps) {
  const { t } = useI18n()
  const isUser = role === 'user'
  const isError = !isUser && status === 'error'
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setCopied(false), 1500)
    } catch (copyError) {
      console.warn('[message] 复制失败', copyError)
    }
  }

  const bubble: CSSProperties = {
    maxWidth: '100%',
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
      className="msg-row"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        minWidth: 0,
      }}
    >
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

      {/* 悬浮或键盘聚焦时出现；空内容不显示动作 */}
      {content.trim().length > 0 && (
        <div
          className="msg-actions"
          style={{ display: 'flex', gap: space.xs, marginTop: space.xs / 2 }}
        >
          <IconButton
            icon={copied ? 'check' : 'copy'}
            size="xs"
            label={copied ? t('message.copied') : t('message.copy')}
            onClick={() => void handleCopy()}
          />
          {isUser && onEdit && (
            <IconButton
              icon="pencil"
              size="xs"
              label={t('message.edit')}
              onClick={() => onEdit(content)}
            />
          )}
        </div>
      )}
    </div>
  )
}
