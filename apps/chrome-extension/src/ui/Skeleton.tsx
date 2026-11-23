// 骨架屏：内容形状的占位块，比「加载中…」更能稳定布局、减少跳动。
//
// 动画定义在 theme.css（.ui-skeleton）；prefers-reduced-motion 下变为静态灰块。

import type { CSSProperties, ReactNode } from 'react'
import { radius, space } from './tokens'
import { cx } from './style'

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  /** 圆角半径，默认 radius.sm */
  radius?: number
  style?: CSSProperties
  className?: string
}

export function Skeleton({
  width = '100%',
  height = 10,
  radius: borderRadius = radius.sm,
  style,
  className,
}: SkeletonProps) {
  return (
    <span
      className={cx('ui-skeleton', className)}
      aria-hidden="true"
      style={{ width, height, borderRadius, ...style }}
    />
  )
}

export interface SkeletonLinesProps {
  /** 行数，默认 3 */
  lines?: number
  lineHeight?: number
  gap?: number
  style?: CSSProperties
}

/** 多行文本骨架；最后一行收窄，读起来更像一段文字而不是表格 */
export function SkeletonLines({
  lines = 3,
  lineHeight = 10,
  gap = space.sm,
  style,
}: SkeletonLinesProps): ReactNode {
  return (
    <div
      aria-hidden="true"
      style={{ display: 'flex', flexDirection: 'column', gap, width: '100%', ...style }}
    >
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? '62%' : '100%'}
        />
      ))}
    </div>
  )
}
