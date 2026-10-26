// 无副作用诊断工具：用于在没有浏览器工具的阶段验证 Agent Loop 全链路
// 不属于浏览器能力，不会触碰页面或数据

import type { AgentTool, ToolResult } from './types'

export function createEchoTool(): AgentTool {
  return {
    name: 'echo',
    description:
      '回显一段文本，仅用于验证工具调用链路。没有任何副作用，不会读取或修改页面。',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '需要回显的文本',
          maxLength: 500,
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
    async execute(args): Promise<ToolResult> {
      const text = typeof args.text === 'string' ? args.text : ''
      return {
        ok: true,
        data: { text, length: text.length },
        message: `已回显 ${text.length} 个字符`,
      }
    },
  }
}
