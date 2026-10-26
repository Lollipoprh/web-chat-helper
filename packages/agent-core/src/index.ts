// agent-core 包
// 职责：Agent 执行循环核心
// 已实现（阶段 4）：
//   - 工具注册表与统一结果/错误码
//   - Agent Loop：模型请求 → Tool Call 解析 → 参数校验 → 执行 → 结果回传 → 下一轮
//   - 轮次上限（默认 10 轮）、重复调用拦截、工具超时、取消信号
//   - 脱敏的结构化调用日志
// 后续：阶段 6 接入用户确认（副作用动作）与任务检查点

export * from './types'
export * from './validation'
export * from './registry'
export * from './loop'
export * from './diagnostic-tools'
