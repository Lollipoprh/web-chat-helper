// `/` 内置指令：解析、命令表与分发
//
// 指令只在 Side Panel 本地执行，不发给模型、不落库、不计费。
// 解析是纯函数，便于单测；真正的 UI 动作由宿主通过 SlashCommandContext 注入。

import type { MessageKey } from '../shared/i18n'

export interface ParsedSlashCommand {
  name: string
  /** 指令后的原始参数，已去除首尾空白；无参数时为空字符串 */
  args: string
}

export type SlashParseResult =
  | { type: 'message' }
  | { type: 'command'; command: ParsedSlashCommand }
  | { type: 'unknown'; name: string }

/** 整条消息匹配：`/name` 或 `/name 参数`（参数可跨行） */
const SLASH_PATTERN = /^\/([a-z][a-z0-9-]{0,23})(?:\s+([\s\S]*))?$/i

export interface SlashCommandDefinition {
  name: string
  usage: string
  descriptionKey: MessageKey
}

export const SLASH_COMMANDS: readonly SlashCommandDefinition[] = [
  { name: 'compact', usage: '/compact', descriptionKey: 'sidepanel.slash.compactDesc' },
  { name: 'memory', usage: '/memory', descriptionKey: 'sidepanel.slash.memoryDesc' },
  { name: 'help', usage: '/help', descriptionKey: 'sidepanel.slash.helpDesc' },
  { name: 'clear', usage: '/clear', descriptionKey: 'sidepanel.slash.clearDesc' },
]

export const SLASH_COMMAND_NAMES: ReadonlySet<string> = new Set(
  SLASH_COMMANDS.map((command) => command.name),
)

/**
 * 只有整条消息是 `/xxx` 时才按指令处理。
 * - 白名单内：返回 command（大小写不敏感）；
 * - 白名单外且无参数：返回 unknown，宿主提示"未识别"，不发送给模型；
 * - 白名单外但有参数：更像普通文本（例如 `/api 用法`），原样按消息发送。
 */
export function parseSlashCommand(text: string): SlashParseResult {
  const trimmed = text.trim()
  const match = SLASH_PATTERN.exec(trimmed)
  if (!match) return { type: 'message' }

  const name = match[1].toLowerCase()
  const args = (match[2] ?? '').trim()
  if (SLASH_COMMAND_NAMES.has(name)) {
    return { type: 'command', command: { name, args } }
  }
  return args ? { type: 'message' } : { type: 'unknown', name }
}

export type SlashCommandOutcome =
  | { kind: 'notice'; text: string }
  | { kind: 'memory'; text: string }
  | { kind: 'clear' }

/** 宿主提供的能力；分发本身不直接动 UI */
export interface SlashCommandContext {
  compact: () => Promise<string>
  memory: () => Promise<string>
  help: () => string
}

export async function runSlashCommand(
  command: ParsedSlashCommand,
  context: SlashCommandContext,
): Promise<SlashCommandOutcome> {
  switch (command.name) {
    case 'compact':
      return { kind: 'notice', text: await context.compact() }
    case 'memory':
      return { kind: 'memory', text: await context.memory() }
    case 'help':
      return { kind: 'notice', text: context.help() }
    case 'clear':
      return { kind: 'clear' }
    default:
      return { kind: 'notice', text: '' }
  }
}
