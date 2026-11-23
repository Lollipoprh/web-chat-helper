// Markdown 渲染：把 parseMarkdown 的结果拼成 React 元素。
//
// 全程不使用 innerHTML，模型输出里的任何 HTML 都只会作为文本显示；
// 链接只放行 http(s) / mailto，并强制 target=_blank + rel=noopener。

import { useState, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '../shared/useI18n'
import { Icon } from './Icon'
import { Tooltip } from './Tooltip'
import { color, fontSize, fontWeight, radius, space } from './tokens'
import { isSafeHref, parseInline, parseMarkdown, type Block, type InlineToken } from './markdown-parse'

export interface MarkdownProps {
  source: string
  /** 追加在正文末尾的节点（例如流式光标） */
  trailing?: ReactNode
}

const CODE_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'

export function Markdown({ source, trailing }: MarkdownProps) {
  const blocks = parseMarkdown(source)
  if (blocks.length === 0) return <>{trailing}</>

  return (
    <div className="ui-markdown" style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
      {blocks.map((block, index) => (
        <BlockView
          key={index}
          block={block}
          trailing={index === blocks.length - 1 ? trailing : undefined}
        />
      ))}
    </div>
  )
}

function BlockView({ block, trailing }: { block: Block; trailing?: ReactNode }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p style={paragraphStyle}>
          {renderInline(parseInline(block.text))}
          {trailing}
        </p>
      )

    case 'heading':
      return (
        <div
          style={{
            fontWeight: fontWeight.semibold,
            fontSize: block.level <= 2 ? fontSize.lg : fontSize.md,
            lineHeight: 1.4,
            color: color.text,
          }}
        >
          {renderInline(parseInline(block.text))}
          {trailing}
        </div>
      )

    case 'code':
      return (
        <>
          <CodeBlock code={block.code} lang={block.lang} />
          {trailing}
        </>
      )

    case 'list':
      return block.ordered ? (
        <ol style={listStyle}>
          {block.items.map((item, index) => (
            <li key={index} style={listItemStyle}>
              {renderInline(parseInline(item))}
              {index === block.items.length - 1 ? trailing : null}
            </li>
          ))}
        </ol>
      ) : (
        <ul style={listStyle}>
          {block.items.map((item, index) => (
            <li key={index} style={listItemStyle}>
              {renderInline(parseInline(item))}
              {index === block.items.length - 1 ? trailing : null}
            </li>
          ))}
        </ul>
      )

    case 'quote':
      return (
        <blockquote
          style={{
            margin: 0,
            padding: `2px 0 2px ${space.md}px`,
            borderLeft: `3px solid ${color.borderStrong}`,
            color: color.textMuted,
          }}
        >
          {renderInline(parseInline(block.text))}
          {trailing}
        </blockquote>
      )

    case 'rule':
      return (
        <>
          <hr
            style={{
              margin: `${space.xs}px 0`,
              border: 'none',
              borderTop: `1px solid ${color.border}`,
            }}
          />
          {trailing}
        </>
      )

    case 'table':
      return (
        <>
          <TableView block={block} />
          {trailing}
        </>
      )
  }
}

function TableView({ block }: { block: Extract<Block, { type: 'table' }> }) {
  const cell: CSSProperties = {
    padding: '3px 6px',
    border: `1px solid ${color.border}`,
    textAlign: 'left',
    verticalAlign: 'top',
    whiteSpace: 'normal',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: fontSize.xs,
          lineHeight: 1.5,
          color: color.text,
          width: 'max-content',
          maxWidth: '100%',
        }}
      >
        <thead>
          <tr>
            {block.header.map((text, index) => (
              <th
                key={index}
                style={{ ...cell, background: color.surfaceSubtle, fontWeight: fontWeight.medium }}
              >
                {renderInline(parseInline(text))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((text, cellIndex) => (
                <td key={cellIndex} style={cell}>
                  {renderInline(parseInline(text))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.warn('[markdown] 复制代码失败', error)
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        background: color.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space.sm,
          padding: `2px ${space.sm}px`,
          borderBottom: `1px solid ${color.borderMuted}`,
          color: color.textFaint,
          fontSize: fontSize.xs,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lang || 'code'}
        </span>
        <Tooltip content={copied ? t('message.copied') : t('message.copy')}>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={copied ? t('message.copied') : t('message.copy')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              padding: 0,
              border: 'none',
              borderRadius: radius.sm,
              background: 'transparent',
              color: copied ? color.success : color.textFaint,
              cursor: 'pointer',
            }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={12} />
          </button>
        </Tooltip>
      </div>
      <pre
        style={{
          margin: 0,
          padding: `${space.sm}px ${space.md}px`,
          overflowX: 'auto',
          fontSize: fontSize.xs,
          lineHeight: 1.55,
          fontFamily: CODE_FONT,
          color: color.text,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

function renderInline(tokens: InlineToken[]): ReactNode {
  return tokens.map((token, index) => {
    switch (token.type) {
      case 'code':
        return (
          <code
            key={index}
            style={{
              padding: '0 3px',
              borderRadius: radius.xs,
              // 用 surface 而不是 surfaceSubtle：气泡本身就是 surfaceSubtle，
              // 同色会让行内代码在气泡里完全看不见
              background: color.surface,
              fontFamily: CODE_FONT,
              fontSize: fontSize.sm,
            }}
          >
            {token.text}
          </code>
        )
      case 'strong':
        return (
          <strong key={index} style={{ fontWeight: fontWeight.semibold }}>
            {token.text}
          </strong>
        )
      case 'em':
        return <em key={index}>{token.text}</em>
      case 'del':
        return (
          <del key={index} style={{ color: color.textMuted }}>
            {token.text}
          </del>
        )
      case 'link':
        return isSafeHref(token.href) ? (
          <a
            key={index}
            href={token.href}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: color.primary, textDecoration: 'underline' }}
          >
            {token.text}
          </a>
        ) : (
          <span key={index}>{token.text}</span>
        )
      default:
        return <span key={index}>{token.text}</span>
    }
  })
}

const paragraphStyle: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const listItemStyle: CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}
