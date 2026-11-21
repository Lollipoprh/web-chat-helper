// 上下文用量条：宽度自适应侧边栏，用颜色而非文字展示占用。
// 轨道为浅蓝色，输入段浅绿、输出段黄色；窗口占满后整条变为橙红色。
// 具体 token 数值只在鼠标悬浮时通过通用 Tooltip 显示。

import { useI18n } from '../../shared/useI18n'
import { Tooltip, color, radius } from '../../ui'

export interface UsageMeterProps {
  inputTokens: number
  outputTokens: number
  contextWindow: number
}

export function UsageMeter({ inputTokens, outputTokens, contextWindow }: UsageMeterProps) {
  const { t } = useI18n()
  const used = inputTokens + outputTokens
  const full = contextWindow > 0 && used >= contextWindow
  const usedRatio = contextWindow > 0 ? Math.min(1, used / contextWindow) : 0
  const inputRatio = contextWindow > 0 ? Math.min(1, inputTokens / contextWindow) : 0
  const outputRatio = contextWindow > 0 ? Math.min(1 - inputRatio, outputTokens / contextWindow) : 0

  const tooltip = `${t('sidepanel.usageInput')} ${formatTokens(inputTokens)} · ${t(
    'sidepanel.usageOutput',
  )} ${formatTokens(outputTokens)} · ${t('sidepanel.usageWindow')} ${formatTokens(contextWindow)}`

  return (
    <div style={{ padding: '4px 12px 6px' }}>
      <Tooltip content={tooltip} placement="top" style={{ padding: '2px 0' }}>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usedRatio * 100)}
          aria-label={tooltip}
          style={{
            position: 'relative',
            width: '100%',
            height: 6,
            borderRadius: radius.pill,
            overflow: 'hidden',
            boxSizing: 'border-box',
            background: full ? color.usageFull : color.usageTrack,
            // 细边线保留轮廓，外发光让边缘更柔和
            border: `1px solid ${
              full ? 'rgba(244, 81, 30, 0.4)' : 'rgba(37, 99, 235, 0.22)'
            }`,
            boxShadow: full
              ? '0 0 8px rgba(244, 81, 30, 0.45)'
              : '0 0 8px rgba(37, 99, 235, 0.28)',
          }}
        >
          {!full && (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: `${inputRatio * 100}%`,
                  background: color.usageInput,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${inputRatio * 100}%`,
                  width: `${outputRatio * 100}%`,
                  background: color.usageOutput,
                }}
              />
            </>
          )}
        </div>
      </Tooltip>
    </div>
  )
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}
