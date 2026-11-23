// 会话产物列表：只展示元数据，文件本体在系统下载目录里。
//
// 为什么不做预览、不存内容：产物是模型写出的文件，内容已经在下载目录里，
// 再存进 IndexedDB 只会让扩展存储随使用无限膨胀。历史会话因此只留
// 文件名、大小与时间，真正的文件始终由系统下载目录保管。

import type { SessionArtifact } from '../../shared/session-storage'
import { formatDateTime, formatFileSize } from '../../shared/format'
import { useI18n } from '../../shared/useI18n'
import { Button, Icon, Tooltip, color, fontSize, radius, space } from '../../ui'

export interface ArtifactListProps {
  artifacts: SessionArtifact[]
}

/** 在系统文件管理器里定位这个下载；记录失效时退回到下载目录 */
async function revealArtifact(artifact: SessionArtifact): Promise<void> {
  try {
    if (artifact.downloadId !== undefined) {
      await chrome.downloads.show(artifact.downloadId)
      return
    }
  } catch (error) {
    console.warn('[artifact] 定位下载失败，改为打开下载目录', error)
  }
  try {
    await chrome.downloads.showDefaultFolder()
  } catch (error) {
    console.warn('[artifact] 打开下载目录失败', error)
  }
}

export function ArtifactList({ artifacts }: ArtifactListProps) {
  const { t } = useI18n()
  if (artifacts.length === 0) return null

  // 最新的排在最前
  const ordered = [...artifacts].reverse()

  return (
    <section style={{ marginBottom: space.lg }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: space.md,
          marginBottom: space.xs,
          color: color.textSecondary,
          fontSize: fontSize.xs,
        }}
      >
        <span style={{ fontWeight: 500 }}>{t('artifact.title')}</span>
        <span style={{ color: color.textFaint }}>
          {t('artifact.count', { count: ordered.length })}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ordered.map((artifact) => (
          <div
            key={`${artifact.name}:${artifact.createdAt}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space.sm,
              padding: '4px 6px',
              borderRadius: radius.sm,
              background: color.surfaceSubtle,
              fontSize: fontSize.sm,
            }}
          >
            <Icon name="file" size={14} style={{ color: color.textFaint }} />
            <Tooltip
              content={`${artifact.name} · ${formatDateTime(artifact.createdAt)}`}
              style={{ flex: 1, minWidth: 0, display: 'block' }}
            >
              <span
                style={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {artifact.name}
              </span>
            </Tooltip>
            <span style={{ flex: 'none', color: color.textFaint, fontSize: fontSize.xs }}>
              {artifact.bytes !== undefined ? formatFileSize(artifact.bytes) : ''}
            </span>
            <Button
              size="xs"
              variant="text"
              onClick={() => void revealArtifact(artifact)}
              style={{ flex: 'none', padding: '0 4px', color: color.primarySoftText }}
            >
              {t('artifact.show')}
            </Button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: space.xs, color: color.textFaint, fontSize: fontSize.xs }}>
        {t('artifact.hint')}
      </div>
    </section>
  )
}
