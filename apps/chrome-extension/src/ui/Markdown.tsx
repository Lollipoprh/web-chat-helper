// Markdown 渲染：把 parseMarkdown 的结果拼成 React 元素。
//
// 全程不使用 innerHTML，模型输出里的任何 HTML 都只会作为文本显示；
// 链接只放行 http(s) / mailto，并强制 target=_blank + rel=noopener。

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '../shared/useI18n'
import { Icon } from './Icon'
import { Tooltip } from './Tooltip'
import { color, fontSize, fontWeight, radius, space } from './tokens'
import { isSafeHref, parseInline, parseMarkdown, type Block, type InlineToken } from './markdown-parse'

export interface MarkdownProps {
  source: string
  /** 追加在正文末尾的节点（例如流式光标） */
  trailing?: ReactNode
  /**
   * 表格首列固定时的底色。必须与气泡背景一致，否则横向滚动时
   * 滚过去的内容会从固定列下面透出来。默认按 surfaceSubtle 处理。
   */
  tableSurface?: string
}

const CODE_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'

export function Markdown({ source, trailing, tableSurface }: MarkdownProps) {
  const blocks = parseMarkdown(source)
  if (blocks.length === 0) return <>{trailing}</>

  return (
    <div className="ui-markdown" style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
      {blocks.map((block, index) => (
        <BlockView
          key={index}
          block={block}
          tableSurface={tableSurface}
          trailing={index === blocks.length - 1 ? trailing : undefined}
        />
      ))}
    </div>
  )
}

function BlockView({
  block,
  tableSurface,
  trailing,
}: {
  block: Block
  tableSurface?: string
  trailing?: ReactNode
}) {
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
          <TableView block={block} surface={tableSurface ?? color.surfaceSubtle} />
          {trailing}
        </>
      )
  }
}

// 侧栏宽度有限，表格是唯一可能比容器宽的内容。策略是「先压再滚」：
// 1. 表格宽度跟随气泡（100%），列宽由内容自动分配；
// 2. 单元格允许在必要时断词（长 URL、长标识符），并保留最小列宽，
//    避免表格被内容一路撑宽；
// 3. 压到最小宽度仍放不下时，容器横向滚动，首列固定住，并在表格下方提示。
function TableView({
  block,
  surface,
}: {
  block: Extract<Block, { type: 'table' }>
  surface: string
}) {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [overflowing, setOverflowing] = useState(false)

  // 只在真的溢出时才提示，避免每张窄表下面都挂一行没用的字。
  // 观察容器和表格本身：两者任一尺寸变化（窗口宽度、流式追加内容）都能重新判断。
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const update = () => setOverflowing(container.scrollWidth - container.clientWidth > 1)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    const table = container.firstElementChild
    if (table) observer.observe(table)
    return () => observer.disconnect()
  }, [])

  const cell: CSSProperties = {
    padding: '3px 6px',
    border: `1px solid ${color.border}`,
    textAlign: 'left',
    verticalAlign: 'top',
    whiteSpace: 'normal',
    // 默认单元格的最小宽度由最长的不可断词决定；anywhere 让长 URL 不再把整张表撑爆
    overflowWrap: 'anywhere',
    minWidth: 48,
  }

  // 首列固定：横向滚动时仍能对上是哪一行。底色必须与气泡一致，否则滚过的内容会透出来
  const firstCell: CSSProperties = {
    position: 'sticky',
    left: 0,
    background: surface,
    boxShadow: `1px 0 0 ${color.border}`,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, maxWidth: '100%' }}>
      <div
        ref={scrollRef}
        className="ui-table-scroll"
        // 横向滚到边界时不要把整个侧栏一起带着滚
        role="group"
        aria-label={t('markdown.tableRegion')}
        // 溢出时让容器可聚焦，键盘用户也能用方向键横向滚动
        tabIndex={overflowing ? 0 : undefined}
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflowX: 'auto',
          overscrollBehaviorX: 'contain',
        }}
      >
        <table
          style={{
            borderCollapse: 'collapse',
            fontSize: fontSize.xs,
            lineHeight: 1.5,
            color: color.text,
            // 跟随气泡宽度；内容压不下去时由外层滚动接管
            width: '100%',
          }}
        >
          <thead>
            <tr>
              {block.header.map((text, index) => (
                <th
                  key={index}
                  style={{
                    ...cell,
                    ...(index === 0 ? firstCell : null),
                    background: color.surfaceSubtle,
                    fontWeight: fontWeight.medium,
                  }}
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
                  <td
                    key={cellIndex}
                    style={{ ...cell, ...(cellIndex === 0 ? firstCell : null) }}
                  >
                    {renderInline(parseInline(text))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overflowing && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space.xs,
            fontSize: fontSize.xs,
            color: color.textFaint,
          }}
        >
          <span aria-hidden="true">↔</span>
          <span>{t('markdown.tableScrollHint')}</span>
        </div>
      )}
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
