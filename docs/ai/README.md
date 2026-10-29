# AI 索引（docs/ai）

给 AI agent 用的按需索引。`AGENTS.md` 只放指针，详细内容在这里。

## 读取顺序

1. 业务需求 → `features.md`（业务词 → 文件）
2. 中文词对不上代码 → `glossary.md`
3. 需要符号、行号或引用关系 → `codemap/<单元>.md`
4. 架构决策 → `docs/adr/`（尚未建立时不读）

拿到 `路径:行号` 后只读取对应代码段，不要整读热文件。

## 行数预算

`AGENTS.md` ≤130 行，`features.md` ≤150 行，codemap 单片 ≤200 行，总计 ≤900 行。
冷启动目标是 `AGENTS.md`、`features.md` 加两个相关源文件约 400 行。

## 手工与生成

- 手工维护：`README.md`、`features.md`、`glossary.md`
- 自动生成，禁止手改：`codemap/**`
- 重新生成：`pnpm map`
- 一致性校验：`pnpm map:check`
- 路径指针校验：`pnpm docs:check`

## 维护规则

改动涉及新业务概念或模块职责变化时，更新 `features.md`；中文业务词变化时同步更新 `glossary.md`。`pnpm verify` 全绿才算完成。
