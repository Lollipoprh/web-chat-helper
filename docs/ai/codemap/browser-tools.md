<!-- 由 pnpm map 生成，请勿手工编辑；一致性由 pnpm map:check 保证 -->

# packages/browser-tools（3 文件 / 约 546 行）

## src/index.ts (14 行)
reexports: `./tools`, `./types`
imports: `packages/browser-tools/src/tools.ts`, `packages/browser-tools/src/types.ts`
used by: -

## src/tools.ts (373 行)
- :32 — `createBrowserTools`
imports: `agent-core`, `packages/browser-tools/src/types.ts`
used by: `packages/browser-tools/src/index.ts`

## src/types.ts (159 行)
- :6 — `BrowserAction`
- :22 — `BrowserToolRequest`
- :29 — `BrowserToolResponse`
- :33 — `BrowserToolTransport`
- :42 — `ActiveTabInfo`
- :49 — `ElementSummary`
- :60 — `PageSnapshot`
- :75 — `FindElementsResult`
- :80 — `ClickResult`
- :88 — `FillResult`
- :96 — `ScrollResult`
- :102 — `WaitResult`
- :106 — `VerifyResult`
- :112 — `NavigateResult`
- :118 — `SelectResult`
- :129 — `TabSummary`
- :136 — `TabsListResult`
- :142 — `TabOpenResult`
- :150 — `SwitchTabResult`
- :156 — `CloseTabResult`
imports: `agent-core`
used by: `packages/browser-tools/src/index.ts`, `packages/browser-tools/src/tools.ts`
