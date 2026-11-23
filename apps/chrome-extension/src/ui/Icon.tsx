// 图标集：一组 24×24 的线性矢量图标，统一 stroke 宽度与圆角。
//
// 为什么不用字符（▾ ▸ ‹ ×）：文本字形随字体/平台变形，无法参与主题色，
// 也无法保证与文字基线对齐。图标统一用 currentColor，自动跟随深色模式。
//
// 约定：svg 一律 aria-hidden，可访问名称由外层控件提供
// （IconButton 的 label、或与可见文字并排时的文字本身）。

import type { CSSProperties } from 'react'
import { iconSize } from './tokens'
import { cx } from './style'

export type IconName =
  | 'settings'
  | 'server'
  | 'sliders'
  | 'list'
  | 'monitor'
  | 'sun'
  | 'moon'
  | 'plus'
  | 'trash'
  | 'eraser'
  | 'x'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'arrow-up'
  | 'globe'
  | 'file'
  | 'copy'
  | 'pencil'
  | 'paperclip'
  | 'refresh'
  | 'alert'
  | 'check'
  | 'info'

type Shape =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }

const ICONS: Record<IconName, Shape[]> = {
  settings: [
    {
      t: 'path',
      d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    },
    { t: 'circle', cx: 12, cy: 12, r: 3 },
  ],
  server: [
    { t: 'rect', x: 2, y: 2, w: 20, h: 8, rx: 2 },
    { t: 'rect', x: 2, y: 14, w: 20, h: 8, rx: 2 },
    { t: 'line', x1: 6, y1: 6, x2: 6.01, y2: 6 },
    { t: 'line', x1: 6, y1: 18, x2: 6.01, y2: 18 },
  ],
  sliders: [
    { t: 'line', x1: 4, y1: 21, x2: 4, y2: 14 },
    { t: 'line', x1: 4, y1: 10, x2: 4, y2: 3 },
    { t: 'line', x1: 12, y1: 21, x2: 12, y2: 12 },
    { t: 'line', x1: 12, y1: 8, x2: 12, y2: 3 },
    { t: 'line', x1: 20, y1: 21, x2: 20, y2: 16 },
    { t: 'line', x1: 20, y1: 12, x2: 20, y2: 3 },
    { t: 'line', x1: 2, y1: 14, x2: 6, y2: 14 },
    { t: 'line', x1: 10, y1: 8, x2: 14, y2: 8 },
    { t: 'line', x1: 18, y1: 16, x2: 22, y2: 16 },
  ],
  list: [
    { t: 'line', x1: 8, y1: 6, x2: 21, y2: 6 },
    { t: 'line', x1: 8, y1: 12, x2: 21, y2: 12 },
    { t: 'line', x1: 8, y1: 18, x2: 21, y2: 18 },
    { t: 'line', x1: 3, y1: 6, x2: 3.01, y2: 6 },
    { t: 'line', x1: 3, y1: 12, x2: 3.01, y2: 12 },
    { t: 'line', x1: 3, y1: 18, x2: 3.01, y2: 18 },
  ],
  monitor: [
    { t: 'rect', x: 2, y: 3, w: 20, h: 14, rx: 2 },
    { t: 'line', x1: 8, y1: 21, x2: 16, y2: 21 },
    { t: 'line', x1: 12, y1: 17, x2: 12, y2: 21 },
  ],
  sun: [
    { t: 'circle', cx: 12, cy: 12, r: 4 },
    { t: 'line', x1: 12, y1: 2, x2: 12, y2: 4 },
    { t: 'line', x1: 12, y1: 20, x2: 12, y2: 22 },
    { t: 'line', x1: 4.93, y1: 4.93, x2: 6.34, y2: 6.34 },
    { t: 'line', x1: 17.66, y1: 17.66, x2: 19.07, y2: 19.07 },
    { t: 'line', x1: 2, y1: 12, x2: 4, y2: 12 },
    { t: 'line', x1: 20, y1: 12, x2: 22, y2: 12 },
    { t: 'line', x1: 6.34, y1: 17.66, x2: 4.93, y2: 19.07 },
    { t: 'line', x1: 19.07, y1: 4.93, x2: 17.66, y2: 6.34 },
  ],
  moon: [{ t: 'path', d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z' }],
  plus: [
    { t: 'line', x1: 12, y1: 5, x2: 12, y2: 19 },
    { t: 'line', x1: 5, y1: 12, x2: 19, y2: 12 },
  ],
  trash: [
    { t: 'path', d: 'M3 6h18' },
    { t: 'path', d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
    { t: 'path', d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
    { t: 'line', x1: 10, y1: 11, x2: 10, y2: 17 },
    { t: 'line', x1: 14, y1: 11, x2: 14, y2: 17 },
  ],
  eraser: [
    {
      t: 'path',
      d: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21',
    },
    { t: 'path', d: 'M22 21H7' },
    { t: 'path', d: 'm5 11 9 9' },
  ],
  x: [
    { t: 'line', x1: 18, y1: 6, x2: 6, y2: 18 },
    { t: 'line', x1: 6, y1: 6, x2: 18, y2: 18 },
  ],
  'chevron-down': [{ t: 'path', d: 'm6 9 6 6 6-6' }],
  'chevron-left': [{ t: 'path', d: 'm15 18-6-6 6-6' }],
  'chevron-right': [{ t: 'path', d: 'm9 18 6-6-6-6' }],
  'arrow-up': [
    { t: 'line', x1: 12, y1: 19, x2: 12, y2: 5 },
    { t: 'path', d: 'm5 12 7-7 7 7' },
  ],
  globe: [
    { t: 'circle', cx: 12, cy: 12, r: 10 },
    { t: 'path', d: 'M2 12h20' },
    {
      t: 'path',
      d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    },
  ],
  file: [
    { t: 'path', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
    { t: 'path', d: 'M14 2v6h6' },
  ],
  copy: [
    { t: 'rect', x: 9, y: 9, w: 13, h: 13, rx: 2 },
    { t: 'path', d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' },
  ],
  pencil: [
    {
      t: 'path',
      d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
    },
    { t: 'path', d: 'm15 5 4 4' },
  ],
  paperclip: [
    {
      t: 'path',
      d: 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
    },
  ],
  refresh: [
    { t: 'path', d: 'M21 12a9 9 0 1 1-3-6.7L21 8' },
    { t: 'path', d: 'M21 3v5h-5' },
  ],
  alert: [
    {
      t: 'path',
      d: 'm10.29 3.86-8.4 14.6A1.5 1.5 0 0 0 3.2 20.7h17.6a1.5 1.5 0 0 0 1.3-2.24l-8.4-14.6a1.5 1.5 0 0 0-2.6 0z',
    },
    { t: 'line', x1: 12, y1: 9, x2: 12, y2: 13 },
    { t: 'line', x1: 12, y1: 17, x2: 12.01, y2: 17 },
  ],
  check: [{ t: 'path', d: 'M20 6 9 17l-5-5' }],
  info: [
    { t: 'circle', cx: 12, cy: 12, r: 10 },
    { t: 'path', d: 'M12 16v-4' },
    { t: 'path', d: 'M12 8h.01' },
  ],
}

export interface IconProps {
  name: IconName
  /** 边长，默认 iconSize.md（16） */
  size?: number
  strokeWidth?: number
  style?: CSSProperties
  className?: string
}

export function Icon({ name, size = iconSize.md, strokeWidth = 1.75, style, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cx('ui-icon', className)}
      style={{ display: 'block', flex: 'none', ...style }}
    >
      {ICONS[name].map((shape, index) => {
        switch (shape.t) {
          case 'path':
            return <path key={index} d={shape.d} />
          case 'circle':
            return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
          case 'rect':
            return (
              <rect
                key={index}
                x={shape.x}
                y={shape.y}
                width={shape.w}
                height={shape.h}
                rx={shape.rx}
              />
            )
          case 'line':
            return (
              <line
                key={index}
                x1={shape.x1}
                y1={shape.y1}
                x2={shape.x2}
                y2={shape.y2}
              />
            )
        }
      })}
    </svg>
  )
}
