// 工具注册表：唯一入口，保证模型只能调用显式注册过的工具

import type { ToolDefinition } from 'llm-client'
import type { AgentTool } from './types'

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>()

  register(tool: AgentTool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具名重复：${tool.name}`)
    }
    this.tools.set(tool.name, tool)
    return this
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  list(): AgentTool[] {
    return [...this.tools.values()]
  }

  names(): string[] {
    return [...this.tools.keys()]
  }

  /** 转成 Chat Completions 的 tools 字段 */
  toDefinitions(): ToolDefinition[] {
    return this.list().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
      },
    }))
  }
}
