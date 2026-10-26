// 设置页共享的内联样式
// 项目暂不引入 CSS 框架，统一在此维护，避免组件内散落样式值

import type { CSSProperties } from 'react'

export const pageStyle: CSSProperties = {
  maxWidth: 780,
  margin: '0 auto',
  padding: '32px 24px 72px',
}

export const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '18px 20px',
}

export const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 600,
  color: '#111827',
}

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 6,
}

export const hintStyle: CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  marginTop: 6,
  lineHeight: 1.6,
}

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  outline: 'none',
  background: '#fff',
  color: '#111827',
}

export const buttonBaseStyle: CSSProperties = {
  padding: '7px 14px',
  fontSize: 13,
  borderRadius: 6,
  cursor: 'pointer',
  border: '1px solid transparent',
}

export const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#2563eb',
  color: '#fff',
}

export const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
}

export const dangerButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#fff',
  color: '#b91c1c',
  border: '1px solid #fecaca',
}

export const disabledButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#e5e7eb',
  color: '#9ca3af',
  cursor: 'not-allowed',
  border: '1px solid transparent',
}

export const badgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '1px 8px',
  fontSize: 11,
  borderRadius: 999,
  background: '#dbeafe',
  color: '#1d4ed8',
  marginLeft: 8,
}

export const fieldRowStyle: CSSProperties = { marginBottom: 16 }

export const errorTextStyle: CSSProperties = {
  fontSize: 12,
  color: '#b91c1c',
  marginTop: 6,
}
