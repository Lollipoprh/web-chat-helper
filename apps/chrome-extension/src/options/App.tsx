import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_AGENT_LIMITS, type AgentLimits } from 'agent-core'
import {
  createProviderId,
  maskApiKey,
  parseEndpoint,
  type ProviderConfig,
  type ProviderDraft,
} from 'llm-client'
import {
  deleteProvider,
  loadAgentLimits,
  loadDefaultProviderId,
  loadProviders,
  resetAgentLimits,
  saveAgentLimits,
  saveProvider,
  setDefaultProvider,
  type AGENT_LIMITS_KEY,
} from '../shared/storage'
import {
  LOG_MAX_TASKS,
  LOG_RETENTION_DAYS,
  clearAllLogs,
  getLogStats,
  type LogStats,
} from '../shared/step-log-storage'
import ProviderForm from './ProviderForm'
import { contentStyle, shellStyle, sidebarHeaderStyle, sidebarStyle } from './styles'
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  color,
  fontSize,
  fontWeight,
  space,
} from '../ui'

type MenuKey = 'providers' | 'limits' | 'logs'

interface MenuItem {
  key: MenuKey
  label: string
  desc: string
}

const MENU: MenuItem[] = [
  { key: 'providers', label: '供应商', desc: '模型接口与密钥' },
  { key: 'limits', label: '工具限额', desc: '轮次、超时等上限' },
  { key: 'logs', label: '运行日志', desc: '本地任务记录' },
]

export default function App() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>('providers')
  const [storageError, setStorageError] = useState<string | null>(null)

  // —— 供应商
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [providersLoading, setProvidersLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ProviderConfig | null>(null)

  // —— 限额（工具调用上限）
  const [limits, setLimits] = useState<AgentLimits>(DEFAULT_AGENT_LIMITS)
  const [limitsLoading, setLimitsLoading] = useState(true)
  const [limitsSavedAt, setLimitsSavedAt] = useState<number | null>(null)
  const [limitsError, setLimitsError] = useState<string | null>(null)

  // —— 运行日志
  const [logStats, setLogStats] = useState<LogStats | null>(null)

  const refreshProviders = useCallback(async () => {
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
      setProvidersLoading(false)
    }
  }, [])

  const refreshLimits = useCallback(async () => {
    try {
      const next = await loadAgentLimits()
      setLimits(next)
      setLimitsError(null)
    } catch (error) {
      setLimitsError(`读取限额失败：${describeError(error)}`)
    } finally {
      setLimitsLoading(false)
    }
  }, [])

  const refreshLogStats = useCallback(async () => {
    try {
      setLogStats(await getLogStats())
    } catch (error) {
      console.warn('[step-log] 读取日志统计失败', error)
    }
  }, [])

  useEffect(() => {
    void refreshProviders()
  }, [refreshProviders])

  useEffect(() => {
    void refreshLimits()
  }, [refreshLimits])

  useEffect(() => {
    void refreshLogStats()
  }, [refreshLogStats])

  // —— 供应商事件

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

    await refreshProviders()
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

    await refreshProviders()
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

  // —— 限额事件

  const validateLimits = useMemo(() => validate(limits), [limits])

  async function handleSaveLimits() {
    if (!validateLimits.valid) {
      setLimitsError(validateLimits.message)
      return
    }
    try {
      await saveAgentLimits(limits)
      setLimitsSavedAt(Date.now())
      setLimitsError(null)
    } catch (error) {
      setLimitsError(`保存限额失败：${describeError(error)}`)
    }
  }

  async function handleResetLimits() {
    const ok = window.confirm(
      `确定恢复到默认值？\n\nmaxRounds: ${DEFAULT_AGENT_LIMITS.maxRounds} 轮\ntoolTimeoutMs: ${DEFAULT_AGENT_LIMITS.toolTimeoutMs} ms\nrequestTimeoutMs: ${DEFAULT_AGENT_LIMITS.requestTimeoutMs} ms`,
    )
    if (!ok) return
    await resetAgentLimits()
    await refreshLimits()
    setLimitsSavedAt(Date.now())
  }

  function updateLimitField<K extends keyof AgentLimits>(
    key: K,
    raw: string,
  ) {
    // 允许空字符串，清空时视为删除该字段的配置项（validate 会给出错误提示）
    if (raw === '') {
      setLimits((prev) => ({ ...prev, [key]: 0 }))
      return
    }
    const next = Number.parseInt(raw, 10)
    if (!Number.isNaN(next)) {
      setLimits((prev) => ({ ...prev, [key]: next }))
    }
  }

  return (
    <div style={shellStyle}>
      <aside style={sidebarStyle}>
        <div style={sidebarHeaderStyle}>
          <div style={{ fontSize: fontSize.xs, color: color.textFaint, marginTop: 2 }}>设置</div>
        </div>
        <nav style={{ marginTop: space.lg }}>
          {MENU.map((item) => {
            const active = item.key === activeMenu
            return (
              <Button
                key={item.key}
                variant={active ? 'subtle' : 'text'}
                block
                onClick={() => setActiveMenu(item.key)}
                style={{
                  display: 'block',
                  textAlign: 'left',
                  padding: '10px 12px',
                  marginBottom: space.xs,
                  border: 'none',
                  color: active ? color.primarySoftText : color.textSecondary,
                }}
              >
                <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium }}>
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: fontSize.xs,
                    color: active ? color.primary : color.textFaint,
                    marginTop: 1,
                  }}
                >
                  {item.desc}
                </div>
              </Button>
            )
          })}
        </nav>
      </aside>

      <main style={contentStyle}>
        {storageError && (
          <Alert tone="error" style={{ marginBottom: space.xl }}>
            {storageError}
          </Alert>
        )}

        {activeMenu === 'providers' && (
          <ProvidersPanel
            providers={providers}
            defaultId={defaultId}
            loading={providersLoading}
            creating={creating}
            editing={editing}
            setCreating={setCreating}
            setEditing={setEditing}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            onSetDefault={handleSetDefault}
            onError={setStorageError}
          />
        )}

        {activeMenu === 'limits' && (
          <LimitsPanel
            limits={limits}
            loading={limitsLoading}
            savedAt={limitsSavedAt}
            error={limitsError}
            valid={validateLimits.valid}
            validationMessage={validateLimits.message}
            onUpdate={updateLimitField}
            onSave={handleSaveLimits}
            onReset={handleResetLimits}
          />
        )}

        {activeMenu === 'logs' && (
          <LogsPanel
            logStats={logStats}
            onClear={handleClearLogs}
          />
        )}

        <footer
          style={{
            marginTop: 28,
            paddingTop: 16,
            borderTop: `1px solid ${color.border}`,
          }}
        >
          <p style={{ margin: 0, fontSize: fontSize.sm, color: color.textMuted, lineHeight: 1.6 }}>
            说明：API Key 保存在 <code>chrome.storage.local</code>，并非操作系统级密钥保险库，
            仅供个人本机使用。运行日志与会话消息存放在 IndexedDB，与配置存储相互隔离。
          </p>
        </footer>
      </main>
    </div>
  )
}

// ———————————————————————————————————— 子视图 ————————————————————————————————————

interface ProvidersPanelProps {
  providers: ProviderConfig[]
  defaultId: string | null
  loading: boolean
  creating: boolean
  editing: ProviderConfig | null
  setCreating: (value: boolean) => void
  setEditing: (value: ProviderConfig | null) => void
  onSubmit: (draft: ProviderDraft) => Promise<void>
  onDelete: (provider: ProviderConfig) => void
  onSetDefault: (provider: ProviderConfig) => void
  onError: (msg: string | null) => void
}

function ProvidersPanel(props: ProvidersPanelProps) {
  return (
    <>
      <PageHeader
        title="供应商"
        description="配置 OpenAI 兼容的模型供应商。所有配置只保存在本机浏览器中，不会上传。"
      />

      <Card
        title="供应商列表"
        extra={
          <Button
            variant="primary"
            onClick={() => {
              props.setEditing(null)
              props.setCreating(true)
            }}
          >
            新增供应商
          </Button>
        }
      >
        <div style={{ marginTop: space.xl }}>
          {props.loading ? (
            <p style={{ color: color.textMuted, fontSize: fontSize.md, margin: 0 }}>加载中…</p>
          ) : props.providers.length === 0 ? (
            <p style={{ color: color.textMuted, fontSize: fontSize.md, margin: 0 }}>
              尚未配置任何供应商。至少添加一个并设为默认，侧边栏才能发起对话。
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {props.providers.map((provider) => {
                const endpoint = parseEndpoint(provider.baseUrl)
                const isDefault = provider.id === props.defaultId
                return (
                  <li
                    key={provider.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: space.lg,
                      padding: '14px 0',
                      borderTop: `1px solid ${color.borderMuted}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: fontSize.lg,
                          fontWeight: fontWeight.semibold,
                          color: color.text,
                        }}
                      >
                        {provider.name}
                        {isDefault && <Badge>默认</Badge>}
                      </div>
                      <div
                        style={{ fontSize: fontSize.sm, color: color.textMuted, marginTop: space.xs }}
                      >
                        模型 {provider.model} · 密钥 {maskApiKey(provider.apiKey)}
                      </div>
                      <div
                        style={{
                          fontSize: fontSize.sm,
                          color: color.textFaint,
                          marginTop: 2,
                          wordBreak: 'break-all',
                        }}
                      >
                        {endpoint.ok ? endpoint.endpoint.chatCompletionsUrl : provider.baseUrl}
                      </div>
                      <div
                        style={{ fontSize: fontSize.xs, color: color.textFaint, marginTop: space.xs }}
                      >
                        {provider.supportsStreaming ? '流式' : '非流式'} ·{' '}
                        {provider.supportsToolCalls ? '支持 Tool Calls' : '不支持 Tool Calls'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: space.sm, flexShrink: 0 }}>
                      {!isDefault && (
                        <Button
                          variant="secondary"
                          onClick={() => void props.onSetDefault(provider)}
                        >
                          设为默认
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => {
                          props.setCreating(false)
                          props.setEditing(provider)
                        }}
                      >
                        编辑
                      </Button>
                      <Button variant="danger" onClick={() => void props.onDelete(provider)}>
                        删除
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>

      {(props.creating || props.editing) && (
        <ProviderForm
          key={props.editing?.id ?? 'new'}
          initial={props.editing ?? undefined}
          onSubmit={props.onSubmit}
          onCancel={() => {
            props.setCreating(false)
            props.setEditing(null)
          }}
        />
      )}
    </>
  )
}

interface LimitsPanelProps {
  limits: AgentLimits
  loading: boolean
  savedAt: number | null
  error: string | null
  valid: boolean
  validationMessage: string
  onUpdate: <K extends keyof AgentLimits>(key: K, raw: string) => void
  onSave: () => void
  onReset: () => void
}

function LimitsPanel(props: LimitsPanelProps) {
  return (
    <>
      <PageHeader
        title="工具限额"
        description="应用级默认值。设置后，所有新发起的 Side Panel 对话都会使用这里的限额。"
      />

      <Card>
        {props.loading ? (
          <p style={{ color: color.textMuted, fontSize: fontSize.md, margin: 0 }}>加载中…</p>
        ) : (
          <>
            <Field
              label="最大工具调用轮次（maxRounds）"
              hint={`模型最多执行 N 轮 "模型返回 → 工具调用"。超出即停止，避免死循环。默认 ${DEFAULT_AGENT_LIMITS.maxRounds}。`}
            >
              <Input
                type="number"
                min={1}
                max={100}
                value={props.limits.maxRounds}
                onChange={(e) => props.onUpdate('maxRounds', e.target.value)}
              />
            </Field>

            <Field
              label="单工具执行超时（toolTimeoutMs，毫秒）"
              hint={`单次工具调用（点击、输入等）最长等待时间。超时视为该步失败。默认 ${DEFAULT_AGENT_LIMITS.toolTimeoutMs.toLocaleString()} ms。`}
            >
              <Input
                type="number"
                min={1000}
                step={1000}
                value={props.limits.toolTimeoutMs}
                onChange={(e) => props.onUpdate('toolTimeoutMs', e.target.value)}
              />
            </Field>

            <Field
              label="模型请求超时（requestTimeoutMs，毫秒）"
              hint={`单次 Chat Completions 请求的最长等待时间（流式与非流式通用）。默认 ${DEFAULT_AGENT_LIMITS.requestTimeoutMs.toLocaleString()} ms。`}
            >
              <Input
                type="number"
                min={5000}
                step={1000}
                value={props.limits.requestTimeoutMs}
                onChange={(e) => props.onUpdate('requestTimeoutMs', e.target.value)}
              />
            </Field>

            {props.error && (
              <Alert tone="error" style={{ marginTop: space.lg }}>
                {props.error}
              </Alert>
            )}
            {!props.valid && !props.error && (
              <p
                style={{
                  marginTop: space.lg,
                  fontSize: fontSize.sm,
                  color: color.danger,
                }}
              >
                {props.validationMessage}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                gap: space.md,
                marginTop: space.lg,
                alignItems: 'center',
              }}
            >
              <Button variant="primary" onClick={props.onSave}>
                保存
              </Button>
              <Button variant="secondary" onClick={props.onReset}>
                恢复默认
              </Button>
              {props.savedAt && (
                <span style={{ fontSize: fontSize.xs, color: color.textMuted, marginLeft: space.md }}>
                  已保存于 {formatTime(props.savedAt)}
                </span>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  )
}

interface LogsPanelProps {
  logStats: LogStats | null
  onClear: () => void
}

function LogsPanel(props: LogsPanelProps) {
  return (
    <>
      <PageHeader
        title="运行日志"
        description="任务日志保存在本机 IndexedDB，Side Panel 的「任务记录」视图可以按会话检索。"
      />

      <Card
        title="本地日志统计"
        extra={
          <Button variant="danger" onClick={props.onClear}>
            清空日志
          </Button>
        }
      >
        <p
          style={{
            margin: '12px 0 0',
            fontSize: fontSize.sm,
            color: color.textMuted,
            lineHeight: 1.7,
          }}
        >
          最多保留 {LOG_RETENTION_DAYS} 天或 {LOG_MAX_TASKS} 个任务（先到者为准），到期自动清理。
          日志只记录脱敏后的工具参数与结果摘要，不含页面正文、表单值、Cookie 与 API Key。
          {props.logStats
            ? ` 当前有 ${props.logStats.taskCount} 个任务、${props.logStats.stepCount} 条步骤记录。`
            : ''}
        </p>
      </Card>
    </>
  )
}

// ———————————————————————————————————— helpers ————————————————————————————————————

function validate(limits: AgentLimits): { valid: boolean; message: string } {
  const parts: string[] = []
  if (!Number.isInteger(limits.maxRounds) || limits.maxRounds < 1) {
    parts.push('最大工具调用轮次必须是正整数')
  }
  if (!Number.isInteger(limits.toolTimeoutMs) || limits.toolTimeoutMs < 1000) {
    parts.push('单工具执行超时必须是不小于 1000 的整数（毫秒）')
  }
  if (
    !Number.isInteger(limits.requestTimeoutMs) ||
    limits.requestTimeoutMs < 5000
  ) {
    parts.push('模型请求超时必须是不小于 5000 的整数（毫秒）')
  }
  if (parts.length === 0) return { valid: true, message: '' }
  return { valid: false, message: parts.join('；') }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

