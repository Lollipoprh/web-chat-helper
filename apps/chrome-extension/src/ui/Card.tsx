import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, fontWeight, radius, space } from './tokens'
import { cx, mergeStyle } from './style'

export interface CardProps {
  /** 卡片标题；与 extra 一起渲染为标题行 */
  title?: ReactNode
  /** 标题行右侧内容，通常是操作按钮 */
  extra?: ReactNode
  children: ReactNode
  style?: CSSProperties
  className?: string
}

const base: CSSProperties = {
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.xl,
  padding: '18px 20px',
}

const headerBase: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.lg,
}

const titleBase: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: fontWeight.semibold,
  color: color.text,
  lineHeight: 1.4,
}

export function Card({ title, extra, children, style, className }: CardProps) {
  return (
    <section className={cx('ui-card', className)} style={mergeStyle(base, style)}>
      {(title || extra) && (
        <div style={headerBase}>
          {title ? <h2 style={titleBase}>{title}</h2> : <span />}
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  style?: CSSProperties
}

export function PageHeader({ title, description, style }: PageHeaderProps) {
  const wrapper: CSSProperties = { marginBottom: space.xxl }
  return (
    <header style={mergeStyle(wrapper, style)}>
      <h1
        style={{
          margin: 0,
          fontSize: fontSize.xl,
          fontWeight: fontWeight.semibold,
          color: color.text,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h1>
      {description && (
        <p
          style={{
            margin: '8px 0 0',
            color: color.textMuted,
            fontSize: fontSize.md,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      )}
    </header>
  )
}
