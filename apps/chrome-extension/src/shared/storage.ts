// 供应商配置的持久化封装
// 存储位置：chrome.storage.local
// 注意：这不是密钥保险库，同机其他进程有手段读取浏览器存储；UI 中已向用户说明

import { DEFAULT_AGENT_LIMITS, type AgentLimits } from 'agent-core'
import type { ProviderConfig } from 'llm-client'

export const PROVIDERS_STORAGE_KEY = 'providers'
export const DEFAULT_PROVIDER_STORAGE_KEY = 'defaultProviderId'
/**
 * 是否跳过副作用动作的用户确认弹窗。
 * 默认 false：每次 click/fill 等改页面动作都要用户点「确认执行」。
 * 设为 true 时全局自动放行，风险自担 —— 切换到 true 需在 UI 上二次确认。
 */
export const UNSAFE_SKIP_CONFIRM_KEY = 'unsafeSkipConfirm'
export const AGENT_LIMITS_KEY = 'agentLimits'

export async function loadProviders(): Promise<ProviderConfig[]> {
  const stored = await chrome.storage.local.get(PROVIDERS_STORAGE_KEY)
  const raw = stored[PROVIDERS_STORAGE_KEY]
  if (!Array.isArray(raw)) return []

  return raw
    .filter(isProviderConfig)
    .map(normalizeProvider)
    .sort((a, b) => a.createdAt - b.createdAt)
}

/** 新增或更新（按 id 匹配），返回更新后的完整列表 */
export async function saveProvider(provider: ProviderConfig): Promise<ProviderConfig[]> {
  const providers = await loadProviders()
  const index = providers.findIndex((item) => item.id === provider.id)

  if (index >= 0) {
    providers[index] = { ...provider, createdAt: providers[index].createdAt }
  } else {
    providers.push(provider)
  }

  await chrome.storage.local.set({ [PROVIDERS_STORAGE_KEY]: providers })
  return providers
}

/** 删除供应商；若删除的是默认项，自动切到剩下的第一个 */
export async function deleteProvider(id: string): Promise<{
  providers: ProviderConfig[]
  defaultProviderId: string | null
}> {
  const providers = (await loadProviders()).filter((item) => item.id !== id)
  const currentDefault = await loadDefaultProviderId()
  const defaultProviderId =
    currentDefault === id ? (providers[0]?.id ?? null) : currentDefault

  await chrome.storage.local.set({
    [PROVIDERS_STORAGE_KEY]: providers,
    [DEFAULT_PROVIDER_STORAGE_KEY]: defaultProviderId,
  })

  return { providers, defaultProviderId }
}

export async function setDefaultProvider(id: string): Promise<void> {
  await chrome.storage.local.set({ [DEFAULT_PROVIDER_STORAGE_KEY]: id })
}

export async function loadDefaultProviderId(): Promise<string | null> {
  const stored = await chrome.storage.local.get(DEFAULT_PROVIDER_STORAGE_KEY)
  const value = stored[DEFAULT_PROVIDER_STORAGE_KEY]
  return typeof value === 'string' && value ? value : null
}

/**
 * 读取默认供应商。若默认 id 失效（例如列表被外部清空），回退到第一个。
 * 返回 null 表示尚未配置任何供应商。
 */
export async function loadDefaultProvider(): Promise<ProviderConfig | null> {
  const [providers, defaultId] = await Promise.all([loadProviders(), loadDefaultProviderId()])
  if (providers.length === 0) return null

  const matched = providers.find((item) => item.id === defaultId)
  if (matched) return matched

  const fallback = providers[0]
  await setDefaultProvider(fallback.id)
  return fallback
}

function isProviderConfig(value: unknown): value is ProviderConfig {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.baseUrl === 'string' &&
    typeof item.apiKey === 'string' &&
    typeof item.model === 'string'
  )
}

/** 兼容早期版本可能缺失的字段，避免读到 undefined */
function normalizeProvider(provider: ProviderConfig): ProviderConfig {
  return {
    ...provider,
    supportsStreaming: provider.supportsStreaming !== false,
    supportsToolCalls: provider.supportsToolCalls !== false,
    createdAt: typeof provider.createdAt === 'number' ? provider.createdAt : Date.now(),
    updatedAt: typeof provider.updatedAt === 'number' ? provider.updatedAt : Date.now(),
  }
}

/** 读取副作用动作的确认豁免开关；默认 false（仍需用户确认） */
export async function loadSkipConfirm(): Promise<boolean> {
  const stored = await chrome.storage.local.get(UNSAFE_SKIP_CONFIRM_KEY)
  return stored[UNSAFE_SKIP_CONFIRM_KEY] === true
}

/** 写入副作用动作的确认豁免开关 */
export async function saveSkipConfirm(skip: boolean): Promise<void> {
  await chrome.storage.local.set({ [UNSAFE_SKIP_CONFIRM_KEY]: skip })
}

/**
 * 读取应用级 Agent 限额；未配置或字段缺失时回退到 agent-core 默认值。
 * 所有限额字段必须是正整数，非法值会被丢弃对应字段。
 */
export async function loadAgentLimits(): Promise<AgentLimits> {
  const stored = await chrome.storage.local.get(AGENT_LIMITS_KEY)
  const raw = stored[AGENT_LIMITS_KEY]
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AGENT_LIMITS }
  const partial = raw as Record<string, unknown>
  const next: AgentLimits = { ...DEFAULT_AGENT_LIMITS }
  if (isPositiveInt(partial.maxRounds)) next.maxRounds = partial.maxRounds
  if (isPositiveInt(partial.toolTimeoutMs)) next.toolTimeoutMs = partial.toolTimeoutMs
  if (isPositiveInt(partial.requestTimeoutMs))
    next.requestTimeoutMs = partial.requestTimeoutMs
  return next
}

/** 写入 Agent 限额；会覆盖全部字段 */
export async function saveAgentLimits(limits: AgentLimits): Promise<void> {
  await chrome.storage.local.set({ [AGENT_LIMITS_KEY]: limits })
}

/** 清除用户配置，恢复到 agent-core 内置默认值 */
export async function resetAgentLimits(): Promise<void> {
  await chrome.storage.local.remove(AGENT_LIMITS_KEY)
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}
