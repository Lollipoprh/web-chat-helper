// 应用内确认框：替代 window.confirm。
//
// window.confirm 的问题：样式不可控（浅色弹窗会打断深色主题）、不支持多行与富文本、
// 会阻塞渲染线程、在侧栏里还会抢走焦点。这里用一个模块级 store + 单个宿主组件，
// 调用方 await 一行即可，行为与 window.confirm 一样是「布尔结果」。
//
// 宿主挂在两个入口页面（侧边栏 / 设置页）各一次，见 main.tsx。

import { useSyncExternalStore, type ReactNode } from 'react'
import { Button, Dialog } from '../ui'
import { useI18n } from './useI18n'

export interface ConfirmOptions {
  title: string
  /** 说明文字；字符串里的换行会保留 */
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 主按钮视觉语义：删除类操作传 danger */
  confirmVariant?: 'primary' | 'danger'
}

interface PendingConfirm {
  options: ConfirmOptions
  resolve: (confirmed: boolean) => void
}

let pending: PendingConfirm | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): PendingConfirm | null {
  return pending
}

/** 打开确认框并等待用户选择；重复调用会让前一个请求按取消处理 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (pending) {
    const previous = pending
    pending = null
    previous.resolve(false)
  }

  return new Promise<boolean>((resolve) => {
    pending = { options, resolve }
    emit()
  })
}

function settle(confirmed: boolean): void {
  const current = pending
  pending = null
  emit()
  current?.resolve(confirmed)
}

/** 确认框宿主：放在应用根部（与 App 同级），全局只需要一个 */
export function ConfirmHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot)
  const { t } = useI18n()

  if (!current) return null

  const { options } = current

  return (
    <Dialog
      open
      title={options.title}
      closeLabel={t('common.close')}
      onClose={() => settle(false)}
      footer={
        <>
          <Button variant="secondary" onClick={() => settle(false)}>
            {options.cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={options.confirmVariant ?? 'primary'}
            onClick={() => settle(true)}
          >
            {options.confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <div style={{ whiteSpace: 'pre-line' }}>{options.message}</div>
    </Dialog>
  )
}
