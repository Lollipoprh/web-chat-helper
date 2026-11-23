// 已绑定文件的只读预览：产物面板的第一次落地。
//
// 读的是会话绑定的 FileSystemFileHandle：只在用户点击时读，读多少由
// PREVIEW_LIMIT 决定（不把大文件整个读进内存），二进制文件给出明确说明。

import { useEffect, useRef, useState } from 'react'
import { getFileHandle, type BoundFileMeta } from '../../shared/file-handle-store'
import { formatDateTime, formatFileSize } from '../../shared/format'
import { useI18n } from '../../shared/useI18n'
import { Dialog, LoadingRow, color, fontSize, radius, space } from '../../ui'

/** 预览上限：约 200 行 / 12k 字符，足够看清内容又不至于卡住渲染 */
const PREVIEW_CHAR_LIMIT = 12_000
const PREVIEW_LINE_LIMIT = 200
/** 超过这个体积只读开头一块，避免整文件读入内存 */
const READ_SLICE_LIMIT = 200_000

interface PreviewState {
  status: 'loading' | 'ready' | 'binary' | 'failed'
  text?: string
  truncated?: boolean
  lineCount?: number
}

export interface FilePreviewProps {
  sessionId: string
  file: BoundFileMeta | null
  onClose: () => void
}

export function FilePreview({ sessionId, file, onClose }: FilePreviewProps) {
  const { t } = useI18n()
  const [state, setState] = useState<PreviewState>({ status: 'loading' })
  const requestRef = useRef(0)

  useEffect(() => {
    if (!file) return
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setState({ status: 'loading' })

    void (async () => {
      try {
        const handle = await getFileHandle(sessionId, file.name)
        if (!handle) throw new Error('handle missing')
        const blob = await handle.getFile()
        const slice = blob.slice(0, Math.min(blob.size, READ_SLICE_LIMIT))
        const text = await slice.text()
        if (requestRef.current !== requestId) return

        // 简单的二进制探测：NUL 字节或大量替换字符就当作不可预览
        const nulIndex = text.indexOf('\u0000')
        const replacement = (text.match(/\uFFFD/g) ?? []).length
        if (nulIndex >= 0 || replacement > text.length * 0.02) {
          setState({ status: 'binary' })
          return
        }

        const lines = text.split('\n')
        const clippedByLines = lines.length > PREVIEW_LINE_LIMIT
        const clippedByChars = text.length > PREVIEW_CHAR_LIMIT
        const preview = clippedByLines
          ? lines.slice(0, PREVIEW_LINE_LIMIT).join('\n')
          : text.slice(0, PREVIEW_CHAR_LIMIT)

        setState({
          status: 'ready',
          text: preview,
          truncated: clippedByLines || clippedByChars,
          lineCount: lines.length,
        })
      } catch (error) {
        console.warn('[file] 读取预览失败', error)
        if (requestRef.current === requestId) setState({ status: 'failed' })
      }
    })()
  }, [sessionId, file])

  return (
    <Dialog
      open={file !== null}
      title={file ? t('file.previewTitle', { name: file.name }) : t('file.previewTitle')}
      closeLabel={t('common.close')}
      onClose={onClose}
      width={520}
      footer={
        <span style={{ color: color.textFaint, fontSize: fontSize.xs, flex: 1 }}>
          {file
            ? `${formatFileSize(file.size)} · ${t('file.modified', {
                time: formatDateTime(file.lastModified),
              })}`
            : ''}
        </span>
      }
    >
      {state.status === 'loading' && <LoadingRow label={t('common.loading')} />}

      {state.status === 'binary' && (
        <p style={{ margin: 0, color: color.textMuted }}>{t('file.previewBinary')}</p>
      )}

      {state.status === 'failed' && (
        <p style={{ margin: 0, color: color.danger }}>{t('file.previewFailed')}</p>
      )}

      {state.status === 'ready' && (
        <>
          <pre
            style={{
              margin: 0,
              maxHeight: '46vh',
              overflow: 'auto',
              padding: `${space.sm}px ${space.md}px`,
              borderRadius: radius.sm,
              background: color.surfaceSunken,
              border: `1px solid ${color.border}`,
              fontSize: fontSize.xs,
              lineHeight: 1.6,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              whiteSpace: 'pre',
              color: color.text,
            }}
          >
            {state.text}
          </pre>
          {state.truncated && (
            <p style={{ margin: `${space.sm}px 0 0`, color: color.textFaint, fontSize: fontSize.xs }}>
              {t('file.previewTruncated', {
                lines: PREVIEW_LINE_LIMIT,
                total: state.lineCount ?? 0,
              })}
            </p>
          )}
        </>
      )}
    </Dialog>
  )
}
