// llm-client 包
// 职责：OpenAI 兼容 Chat Completions 客户端
// 已实现：供应商配置类型、Base URL 规范化、最小连接测试、非流式/流式对话、SSE 解析
// 后续：阶段 4 在此基础上增加 Tool Calls 参数累积

export * from './types'
export * from './endpoint'
export * from './errors'
export * from './sse'
export * from './chat'
export * from './connection-test'
