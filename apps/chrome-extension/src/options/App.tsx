import { useCallback, useEffect, useState } from 'react'
import {
  createProviderId,
  maskApiKey,
  parseEndpoint,
  type ProviderConfig,
  type ProviderDraft,
} from 'llm-client'
import {
  deleteProvider,
  loadDefaultProviderId,
  loadProviders,
  saveProvider,
  setDefaultProvider,
} from '../shared/storage'
import {
  LOG_MAX_TASKS,
  LOG_RETENTION_DAYS,
  clearAllLogs,
  getLogStats,
  type LogStats,
} from '../shared/step-log-storage'
import ProviderForm from './ProviderForm'
import {
  badgeStyle,
  cardStyle,
  dangerButtonStyle,
  hintStyle,
  pageStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  sectionTitleStyle,
} from './styles'

export default function App() {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ProviderConfig | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [logStats, setLogStats] = useState<LogStats | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [list, storedDefault] = await Promise.all([
        loadProviders(),
        loadDefaultProviderId(),
      ])
      const effectiveDefault =
        storedDefault && list.some((item) => item.id === storedDefault)
          ? storedDefault
          : (list[0]?.id ?? null)

      if (effectiveDefault && effectiveDefault !== storedDefault) {
        await setDefaultProvider(effectiveDefault)
      }

      setProviders(list)
      setDefaultId(effectiveDefault)
      setStorageError(null)
    } catch (error) {
      setStorageError(`读取配置失败：${describeError(error)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const refreshLogStats = useCallback(async () => {
    try {
      setLogStats(await getLogStats())
    } catch (error) {
      console.warn('[step-log] 读取日志统计失败', error)
    }
  }, [])

  useEffect(() => {
    void refreshLogStats()
  }, [refreshLogStats])

  async function handleClearLogs() {
    const confirmed = window.confirm('确定清空全部本地运行日志吗？该操作不可撤销。')
    if (!confirmed) return

    try {
      await clearAllLogs()
      await refreshLogStats()
    } catch (error) {
      setStorageError(`清空日志失败：${describeError(error)}`)
    }
  }

  async function handleSubmit(draft: ProviderDraft) {
    const now = Date.now()
    const provider: ProviderConfig = editing
      ? { ...editing, ...draft, updatedAt: now }
      : { ...draft, id: createProviderId(), createdAt: now, updatedAt: now }

    try {
      await saveProvider(provider)
    } catch (error) {
      setStorageError(`保存失败：${describeError(error)}`)
      return
    }

    await refresh()
    setCreating(false)
    setEditing(null)
  }

  async function handleDelete(provider: ProviderConfig) {
    const confirmed = window.confirm(
      `确定删除「${provider.name}」吗？该操作不可撤销。`,
    )
    if (!confirmed) return

    try {
      await deleteProvider(provider.id)
    } catch (error) {
      setStorageError(`删除失败：${describeError(error)}`)
      return
    }

    await refresh()
    if (editing?.id === provider.id) setEditing(null)
  }

  async function handleSetDefault(provider: ProviderConfig) {
    try {
      await setDefaultProvider(provider.id)
      setDefaultId(provider.id)
      setStorageError(null)
    } catch (error) {
      setStorageError(`设置默认供应商失败：${describeError(error)}`)
    }
  }

  return (
    <div style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#111827' }}>
          Web Chat Helper 设置
        </h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 13 }}>
          配置 OpenAI 兼容的模型供应商。所有配置只保存在本机浏览器中，不会上传。
        </p>
      </header>

      {storageError && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.6,
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            wordBreak: 'break-word',
          }}
        >
          {storageError}
        </div>
      )}

      <section style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <h2 style={sectionTitleStyle}>供应商</h2>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => {
              setEditing(null)
              setCreating(true)
            }}
          >
            新增供应商
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>加载中…</p>
          ) : providers.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
              尚未配置任何供应商。至少添加一个并设为默认，侧边栏才能发起对话。
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {providers.map((provider) => {
                const endpoint = parseEndpoint(provider.baseUrl)
                const isDefault = provider.id === defaultId
                return (
                  <li
                    key={provider.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '14px 0',
                      borderTop: '1px solid #f3f4f6',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                        {provider.name}
                        {isDefault && <span style={badgeStyle}>默认</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        模型 {provider.model} · 密钥 {maskApiKey(provider.apiKey)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#9ca3af',
                          marginTop: 2,
                          wordBreak: 'break-all',
                        }}
                      >
                        {endpoint.ok ? endpoint.endpoint.chatCompletionsUrl : provider.baseUrl}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {provider.supportsStreaming ? '流式' : '非流式'} ·{' '}
                        {provider.supportsToolCalls ? '支持 Tool Calls' : '不支持 Tool Calls'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {!isDefault && (
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() => void handleSetDefault(provider)}
                        >
                          设为默认
                        </button>
                      )}
                      <button
                        type="button"
                        style={secondaryButtonStyle}
                        onClick={() => {
                          setCreating(false)
                          setEditing(provider)
                        }}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        style={dangerButtonStyle}
                        onClick={() => void handleDelete(provider)}
                      >
                        删除
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {(creating || editing) && (
        <ProviderForm
          key={editing?.id ?? 'new'}
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      <section style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <h2 style={sectionTitleStyle}>本地运行日志</h2>
          <button type="button" style={dangerButtonStyle} onClick={() => void handleClearLogs()}>
            清空日志
          </button>
        </div>

        <p style={{ margin: '12px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
          任务日志保存在本机 IndexedDB，最多保留 {LOG_RETENTION_DAYS} 天或 {LOG_MAX_TASKS}{' '}
          个任务（先到者为准），到期自动清理。日志只记录脱敏后的工具参数与结果摘要，
          不含页面正文、表单值、Cookie 与 API Key。
          {logStats
            ? ` 当前有 ${logStats.taskCount} 个任务、${logStats.stepCount} 条步骤记录。`
            : ''}
        </p>
      </section>

      <footer style={{ marginTop: 28 }}>
        <p style={hintStyle}>
          说明：API Key 保存在 <code>chrome.storage.local</code>，并非操作系统级密钥保险库，
          仅供个人本机使用。日志与界面中只展示脱敏后的密钥。运行日志与会话消息存放在
          IndexedDB，与配置存储相互隔离。
        </p>
      </footer>
    </div>
  )
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
