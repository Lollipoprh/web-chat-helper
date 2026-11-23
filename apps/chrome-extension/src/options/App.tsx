import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { LANG_PREF_VALUES, type LangPref } from '../shared/i18n'
import { langDisplayName, useI18n, type I18n } from '../shared/useI18n'
import { confirm } from '../shared/confirm'
import { THEME_PREF_VALUES, themeNameKey, type ThemePref } from '../shared/theme'
import { useTheme, useApplyTheme } from '../shared/useTheme'
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Input,
  PageHeader,
  Select,
  color,
  fontSize,
  fontWeight,
  space,
  type IconName,
} from '../ui'

type MenuKey = 'providers' | 'limits' | 'logs' | 'general'

interface MenuItem {
  key: MenuKey
  icon: IconName
  label: string
  desc: string
}

export default function App() {
  const { t, lang, pref, setPref } = useI18n()
  // 设置页任何栏目都要用同一套主题：这里初始化一次，
  // 否则停在「供应商」页时不会应用已保存的深色偏好（外观页的 useTheme 只在挂载时才触发）
  useApplyTheme()
  // 只在挂载时读取一次的 effect 用 ref 取 t，避免切换语言触发重新拉取、覆盖未保存的表单
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])
  const [activeMenu, setActiveMenu] = useState<MenuKey>('providers')
  const [storageError, setStorageError] = useState<string | null>(null)

  // 语言放在最后一项：常用配置优先，语言属于一次性设置
  const menu: MenuItem[] = useMemo(
    () => [
      {
        key: 'providers',
        icon: 'server',
        label: t('options.navProviders'),
        desc: t('options.navProvidersDesc'),
      },
      { key: 'limits', icon: 'sliders', label: t('options.navLimits'), desc: t('options.navLimitsDesc') },
      { key: 'logs', icon: 'list', label: t('options.navLogs'), desc: t('options.navLogsDesc') },
      {
        key: 'general',
        icon: 'monitor',
        label: t('options.navGeneral'),
        desc: t('options.navGeneralDesc'),
      },
    ],
    [t],
  )

  // 浏览器标签页标题跟随界面语言
  useEffect(() => {
    document.title = `Web Chat Helper · ${t('common.settings')}`
  }, [t])

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
      setStorageError(
        tRef.current('options.loadProvidersFailed', { message: describeError(error) }),
      )
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
      setLimitsError(
        tRef.current('options.loadLimitsFailed', { message: describeError(error) }),
      )
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
      setStorageError(t('options.saveFailed', { message: describeError(error) }))
      return
    }

    await refreshProviders()
    setCreating(false)
    setEditing(null)
  }

  async function handleDelete(provider: ProviderConfig) {
    const confirmed = await confirm({
      title: t('common.delete'),
      message: t('options.confirmDeleteProvider', { name: provider.name }),
      confirmLabel: t('common.delete'),
      confirmVariant: 'danger',
    })
    if (!confirmed) return

    try {
      await deleteProvider(provider.id)
    } catch (error) {
      setStorageError(t('options.deleteFailed', { message: describeError(error) }))
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
      setStorageError(t('options.setDefaultFailed', { message: describeError(error) }))
    }
  }

  async function handleClearLogs() {
    const confirmed = await confirm({
      title: t('options.clearLogs'),
      message: t('options.confirmClearLogs'),
      confirmLabel: t('options.clearLogs'),
      confirmVariant: 'danger',
    })
    if (!confirmed) return

    try {
      await clearAllLogs()
      await refreshLogStats()
    } catch (error) {
      setStorageError(t('options.clearLogsFailed', { message: describeError(error) }))
    }
  }

  // —— 限额事件

  const validateLimits = useMemo(() => validate(limits, t), [limits, t])

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
      setLimitsError(t('options.saveLimitsFailed', { message: describeError(error) }))
    }
  }

  async function handleResetLimits() {
    const confirmed = await confirm({
      title: t('options.reset'),
      message: t('options.confirmResetLimits', {
        rounds: DEFAULT_AGENT_LIMITS.maxRounds,
        toolTimeout: DEFAULT_AGENT_LIMITS.toolTimeoutMs,
        requestTimeout: DEFAULT_AGENT_LIMITS.requestTimeoutMs,
      }),
      confirmLabel: t('options.reset'),
    })
    if (!confirmed) return
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
          <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
            <img
              src="/icons/icon-48.png"
              alt=""
              aria-hidden="true"
              width={22}
              height={22}
              style={{ flex: 'none', display: 'block' }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: color.text,
                  lineHeight: 1.3,
                }}
              >
                Web Chat Helper
              </div>
              <div style={{ fontSize: fontSize.xs, color: color.textFaint, marginTop: 1 }}>
                {t('common.settings')}
              </div>
            </div>
          </div>
        </div>
        <nav style={{ marginTop: space.lg }}>
          {menu.map((item) => {
            const active = item.key === activeMenu
            return (
              <Button
                key={item.key}
                variant={active ? 'subtle' : 'text'}
                block
                onClick={() => setActiveMenu(item.key)}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space.md,
                  textAlign: 'left',
                  padding: '10px 12px',
                  marginBottom: space.xs,
                  border: 'none',
                  color: active ? color.primarySoftText : color.textSecondary,
                }}
              >
                <Icon
                  name={item.icon}
                  size={16}
                  style={{ color: active ? color.primarySoftText : color.textFaint }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium }}>
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: fontSize.xs,
                      // 激活状态下用柔和的浅蓝：直接用 primary 会在深色底上几乎看不见
                      color: active ? color.primarySoftText : color.textFaint,
                      marginTop: 1,
                    }}
                  >
                    {item.desc}
                  </div>
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

        {activeMenu === 'general' && (
          <GeneralPanel pref={pref} currentLang={lang} onPrefChange={setPref} />
        )}

        <footer
          style={{
            marginTop: 28,
            paddingTop: 16,
            borderTop: `1px solid ${color.border}`,
          }}
        >
          <p style={{ margin: 0, fontSize: fontSize.sm, color: color.textMuted, lineHeight: 1.6 }}>
            {t('options.footerNote')}
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
  const { t } = useI18n()

  return (
    <>
      <PageHeader
        title={t('options.providersTitle')}
        description={t('options.providersDesc')}
      />

      <Card
        title={t('options.providerListTitle')}
        extra={
          <Button
            variant="primary"
            onClick={() => {
              props.setEditing(null)
              props.setCreating(true)
            }}
          >
            {t('options.addProvider')}
          </Button>
        }
      >
        <div style={{ marginTop: space.xl }}>
          {props.loading ? (
            <p style={{ color: color.textMuted, fontSize: fontSize.md, margin: 0 }}>
              {t('common.loading')}
            </p>
          ) : props.providers.length === 0 ? (
            <p style={{ color: color.textMuted, fontSize: fontSize.md, margin: 0 }}>
              {t('options.providersEmpty')}
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
                        {isDefault && (
                          <Badge style={{ marginLeft: space.md }}>
                            {t('options.defaultBadge')}
                          </Badge>
                        )}
                      </div>
                      <div
                        style={{ fontSize: fontSize.sm, color: color.textMuted, marginTop: space.xs }}
                      >
                        {t('options.providerMeta', {
                          model: provider.model,
                          key: maskApiKey(provider.apiKey),
                        })}
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
                        {provider.supportsStreaming
                          ? t('options.streaming')
                          : t('options.nonStreaming')}{' '}
                        ·{' '}
                        {provider.supportsToolCalls
                          ? t('options.toolCallsSupported')
                          : t('options.toolCallsUnsupported')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: space.sm, flexShrink: 0 }}>
                      {!isDefault && (
                        <Button
                          variant="secondary"
                          onClick={() => void props.onSetDefault(provider)}
                        >
                          {t('options.setDefault')}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => {
                          props.setCreating(false)
                          props.setEditing(provider)
                        }}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button variant="danger" onClick={() => void props.onDelete(provider)}>
                        {t('common.delete')}
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
  const { t } = useI18n()

  return (
    <>
      <PageHeader title={t('options.limitsTitle')} description={t('options.limitsDesc')} />

      <Card>
        {props.loading ? (
          <p style={{ color: color.textMuted, fontSize: fontSize.md, margin: 0 }}>
            {t('common.loading')}
          </p>
        ) : (
          <>
            <Field
              label={t('options.maxRoundsLabel')}
              hint={t('options.maxRoundsHint', { default: DEFAULT_AGENT_LIMITS.maxRounds })}
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
              label={t('options.toolTimeoutLabel')}
              hint={t('options.toolTimeoutHint', {
                default: DEFAULT_AGENT_LIMITS.toolTimeoutMs.toLocaleString(),
              })}
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
              label={t('options.requestTimeoutLabel')}
              hint={t('options.requestTimeoutHint', {
                default: DEFAULT_AGENT_LIMITS.requestTimeoutMs.toLocaleString(),
              })}
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
                {t('common.save')}
              </Button>
              <Button variant="secondary" onClick={props.onReset}>
                {t('options.reset')}
              </Button>
              {props.savedAt && (
                <span style={{ fontSize: fontSize.xs, color: color.textMuted, marginLeft: space.md }}>
                  {t('options.savedAt', { time: formatTime(props.savedAt) })}
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
  const { t } = useI18n()

  return (
    <>
      <PageHeader title={t('options.logsTitle')} description={t('options.logsDesc')} />

      <Card
        title={t('options.logStatsTitle')}
        extra={
          <Button variant="danger" onClick={props.onClear}>
            {t('options.clearLogs')}
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
          {t('options.logsBody', { days: LOG_RETENTION_DAYS, tasks: LOG_MAX_TASKS })}
          {props.logStats
            ? ` ${t('options.logStats', {
                tasks: props.logStats.taskCount,
                steps: props.logStats.stepCount,
              })}`
            : ''}
        </p>
      </Card>
    </>
  )
}

interface GeneralPanelProps {
  pref: LangPref
  currentLang: 'zh' | 'en'
  onPrefChange: (pref: LangPref) => Promise<void>
}

function GeneralPanel({ pref, currentLang, onPrefChange }: GeneralPanelProps) {
  const { t } = useI18n()
  const theme = useTheme()

  return (
    <>
      <PageHeader title={t('options.generalTitle')} />

      <Card title={t('options.appearanceTitle')} style={{ marginBottom: space.xl }}>
        <p style={{ margin: '10px 0 0', fontSize: fontSize.sm, color: color.textMuted, lineHeight: 1.7 }}>
          {t('options.appearanceDesc')}
        </p>
        <div style={{ marginTop: space.lg }}>
          <Field label={t('options.themeLabel')} hint={t('options.appearanceScopeNote')}>
            <Select
              value={theme.pref}
              style={{ maxWidth: 320 }}
              options={[
                {
                  value: 'auto',
                  label: t('options.themeAuto', { theme: t(themeNameKey(theme.resolved)) }),
                },
                { value: 'light', label: t('options.themeLight') },
                { value: 'dark', label: t('options.themeDark') },
              ]}
              onChange={(event) => {
                const next = event.target.value
                if (!THEME_PREF_VALUES.includes(next as ThemePref)) return
                void theme.setPref(next as ThemePref)
              }}
            />
          </Field>
        </div>
      </Card>

      <Card title={t('options.languageTitle')}>
        <p style={{ margin: '10px 0 0', fontSize: fontSize.sm, color: color.textMuted, lineHeight: 1.7 }}>
          {t('options.languageDesc')}
        </p>
        <div style={{ marginTop: space.lg }}>
          <Field label={t('options.languageLabel')} hint={t('options.languageScopeNote')}>
            <Select
              value={pref}
              style={{ maxWidth: 320 }}
              options={[
                {
                  value: 'auto',
                  label: t('options.langAuto', { language: langDisplayName(currentLang) }),
                },
                { value: 'zh', label: t('options.langZh') },
                { value: 'en', label: t('options.langEn') },
              ]}
              onChange={(event) => {
                const next = event.target.value
                if (!LANG_PREF_VALUES.includes(next as LangPref)) return
                void onPrefChange(next as LangPref)
              }}
            />
          </Field>
        </div>
      </Card>
    </>
  )
}

// ———————————————————————————————————— helpers ————————————————————————————————————

function validate(
  limits: AgentLimits,
  t: I18n['t'],
): { valid: boolean; message: string } {
  const parts: string[] = []
  if (!Number.isInteger(limits.maxRounds) || limits.maxRounds < 1) {
    parts.push(t('options.errMaxRounds'))
  }
  if (!Number.isInteger(limits.toolTimeoutMs) || limits.toolTimeoutMs < 1000) {
    parts.push(t('options.errToolTimeout'))
  }
  if (
    !Number.isInteger(limits.requestTimeoutMs) ||
    limits.requestTimeoutMs < 5000
  ) {
    parts.push(t('options.errRequestTimeout'))
  }
  if (parts.length === 0) return { valid: true, message: '' }
  return { valid: false, message: parts.join(t('options.joinErrors')) }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

