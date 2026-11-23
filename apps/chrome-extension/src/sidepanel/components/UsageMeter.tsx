// 上下文用量指示：紧凑形态，放在 composer 下方的状态条里。
//
// 之前是通栏长条，独占一行且离发送动作很远。现在压缩成「迷你条 + 百分比」，
// 具体数值仍通过通用 Tooltip 悬浮查看，进度语义保留给读屏。

import { useI18n } from '../../shared/useI18n'
import { Tooltip, color, fontSize, radius, space } from '../../ui'

export interface UsageMeterProps {
  inputTokens: number
  outputTokens: number
  contextWindow: number
  /** 当前上下文估算；提供时进度条按它绘制，而不是会话累计用量 */
  contextTokens?: number
}

/** 迷你进度条宽度：够看出比例，又不至于抢走输入区的空间 */
const BAR_WIDTH = 44

export function UsageMeter({
  inputTokens,
  outputTokens,
  contextWindow,
  contextTokens,
}: UsageMeterProps) {
  const { t } = useI18n()
  const contextMode = contextTokens !== undefined
  const used = contextMode ? Math.max(0, contextTokens) : inputTokens + outputTokens
  const full = contextWindow > 0 && used >= contextWindow
  const usedRatio = contextWindow > 0 ? Math.min(1, used / contextWindow) : 0

  const tooltip = contextMode
    ? `${t('sidepanel.usageContext')} ${formatTokens(used)} · ${t('sidepanel.usageWindow')} ${formatTokens(contextWindow)}`
    : `${t('sidepanel.usageInput')} ${formatTokens(inputTokens)} · ${t(
        'sidepanel.usageOutput',
      )} ${formatTokens(outputTokens)} · ${t('sidepanel.usageWindow')} ${formatTokens(contextWindow)}`

  return (
    <Tooltip content={tooltip} placement="top" className="ui-usage-meter">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(usedRatio * 100)}
        aria-label={tooltip}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: space.xs,
          flex: 'none',
          fontSize: fontSize.xs,
          color: full ? color.danger : color.textFaint,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: BAR_WIDTH,
            height: 4,
            borderRadius: radius.pill,
            background: color.usageTrack,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              display: 'block',
              width: `${Math.max(usedRatio, used > 0 ? 0.02 : 0) * 100}%`,
              height: '100%',
              borderRadius: radius.pill,
              background: full ? color.usageFull : color.primary,
            }}
          />
        </span>
        <span>{Math.round(usedRatio * 100)}%</span>
      </div>
    </Tooltip>
  )
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}
