# Features to Code

Use these product terms to find files and symbols. Line numbers belong in the generated `codemap/` files.

## Model requests and streaming responses

- Request entry points: `packages/llm-client/src/chat.ts` (`streamChatCompletion`, `createChatCompletion`)
- Stream parsing: `packages/llm-client/src/sse.ts` (`consumeSseStream`)
- Token usage parsing: `packages/llm-client/src/chat.ts` (`TokenUsage`, `parseUsage`) — streaming requests send `stream_options.include_usage`; missing usage leaves `ChatResult.usage` undefined
- Endpoint normalization: `packages/llm-client/src/endpoint.ts` (`parseEndpoint`)
- Error mapping: `packages/llm-client/src/errors.ts` (`LLMError`, `httpStatusToLLMError`)

## Page translation from the context menu

- Menu creation and click routing: `apps/chrome-extension/src/background/index.ts` (`requestPageTranslation`)
- Browser-language detection and the packaged task prompt: `apps/chrome-extension/src/shared/translation.ts` (`resolveBrowserLanguage`, `buildTranslatePageTask`)
- Side Panel consumption and auto-start: `apps/chrome-extension/src/sidepanel/App.tsx` (`startQueuedTranslate`, `PENDING_TRANSLATE_REQUEST_KEY`) — creates a new session so every run is saved to task history

## Connection test in settings

- Logic: `packages/llm-client/src/connection-test.ts` (`testConnection`)
- UI: `apps/chrome-extension/src/options/App.tsx`, `apps/chrome-extension/src/options/ProviderForm.tsx`

## Provider configuration storage

- Load/save providers: `apps/chrome-extension/src/shared/storage.ts` (`loadProviders`, `saveProvider`)
- API key encryption at rest: `apps/chrome-extension/src/shared/encryption.ts` (`encryptApiKey`, `decryptApiKey`) — AES-GCM with a PBKDF2-derived key and a per-instance salt; legacy plaintext keys are read unchanged and re-encrypted on the next save

## Agent loop, round limit, and timeout

- Main loop: `packages/agent-core/src/loop.ts` (`runAgentLoop`, `DEFAULT_AGENT_LIMITS`)
- Argument validation: `packages/agent-core/src/validation.ts` (`validateToolArguments`)
- Tool registry: `packages/agent-core/src/registry.ts` (`ToolRegistry`)
- Limit storage: `apps/chrome-extension/src/shared/storage.ts` (`loadAgentLimits`, `saveAgentLimits`)

## Browser tools: snapshots, clicks, forms, tabs, and DOM edits

- Tool definitions: `packages/browser-tools/src/tools.ts` (`createBrowserTools`)
- Result types: `packages/browser-tools/src/types.ts` (`FillResult`, `FillStrategy`, `SelectResult`, `SetTextResult`, `InsertElementResult`)
- In-page execution: `apps/chrome-extension/src/content/index.ts`
- Input injection: `apps/chrome-extension/src/content/input-injection.ts` (`commitText`, `planFillStrategies`, `evaluateFill`) — writes through `execCommand` first, falls back to value setters, then reads the field back before reporting success
- Declarative DOM edits: `set_element_text`, `set_element_attribute`, `set_element_style`, `remove_element`, `insert_element` — attribute/style allowlists and the HTML sanitiser live in `apps/chrome-extension/src/content/index.ts` (`sanitizeInsertedFragment`, `MUTABLE_ATTRIBUTE_NAMES`, `MUTABLE_STYLE_PROPERTIES`); no arbitrary script execution is exposed
- Message transport: `apps/chrome-extension/src/shared/browser-transport.ts`

## Side panel UI and chat interaction

- Main UI: `apps/chrome-extension/src/sidepanel/App.tsx`
- Header: title only plus a gear icon that opens Settings; the model name lives in the bottom `ModelPicker`
- Usage meter: `apps/chrome-extension/src/sidepanel/components/UsageMeter.tsx` — cumulative input/output tokens and context window with a progress bar
- System prompt and task policies: `apps/chrome-extension/src/sidepanel/App.tsx` (`SYSTEM_PROMPT`) — page translation defaults to in-place DOM edits unless the user asks for a chat reply
- Task history: `apps/chrome-extension/src/sidepanel/TaskHistory.tsx`
- Message bubble and tool-call card: `apps/chrome-extension/src/sidepanel/components/`

## Interface language (zh / en)

- Message tables and resolution: `apps/chrome-extension/src/shared/i18n.ts` (`translate`, `resolveLang`, `detectLang`, `UI_LANGUAGE_KEY`)
- React binding and language switcher state: `apps/chrome-extension/src/shared/useI18n.ts` (`useI18n`)
- Manifest-level strings (name, store description, toolbar tooltip): `apps/chrome-extension/public/_locales/`, `apps/chrome-extension/manifest.config.ts` (`default_locale`)
- Language picker (Settings → 通用): `apps/chrome-extension/src/options/App.tsx` (`GeneralPanel`)
- Task text in the UI (history cards, tool-call cards, message bubbles, banners, confirm dialogs) all go through `t()`; dynamic strings use `useI18n()`
- Deliberately not localized: tool-result messages returned to the model in `apps/chrome-extension/src/background/index.ts` and `apps/chrome-extension/src/sidepanel/file-tools.ts` — the model reads them, they are not rendered as UI

## UI components and design tokens

- Design tokens (color, radius, font, spacing, control size): `apps/chrome-extension/src/ui/tokens.ts`
- Shared primitives (Button, Input, TextArea, Select, Checkbox, Field, Alert, Card, Badge, PageHeader): `apps/chrome-extension/src/ui/`
- Component prop conventions and override rules: `apps/chrome-extension/src/ui/index.ts`
- Settings-page layout styles: `apps/chrome-extension/src/options/styles.ts`

## Sessions and task history storage

- Sessions: `apps/chrome-extension/src/shared/session-storage.ts` (`SessionRecord`, `listSessions`)
- Session usage totals: `apps/chrome-extension/src/shared/session-storage.ts` (`addSessionUsage`, `inputTokens`, `outputTokens`) — cumulative per session, reset when the session messages are cleared
- Step logs: `apps/chrome-extension/src/shared/step-log-storage.ts` (`recordStep`, `listSessionTasks`, `pruneLogs`)
- Chat records: `apps/chrome-extension/src/shared/chat-storage.ts`
- IndexedDB setup: `apps/chrome-extension/src/shared/local-db.ts`

## Session-scoped local files

- File handle storage: `apps/chrome-extension/src/shared/file-handle-store.ts` (`bindFile`, `bindFileHandle`, `listBoundFiles`, `unbindFile`, `deleteSessionFiles`) — key is `${session_id}::${name}` with a `by_sessionId` index; the v5 DB upgrade recreates the store and drops legacy global bindings (no migration)
- File tools: `apps/chrome-extension/src/sidepanel/file-tools.ts` (`createFileTools(sessionId)`) — `list_bound_files` and every read/write are limited to files bound to the current session
- Side Panel UI: file list sits above the composer, is hidden when empty, and the "Add file" button opens the system picker directly (no management panel); dropping files onto the chat panel or composer binds them to the current session through `DataTransferItem.getAsFileSystemHandle()`

## Provider configuration: model, key, and URL

- Storage: `apps/chrome-extension/src/shared/storage.ts` (`ProviderConfig`, `loadProviders`, `saveProvider`)
- UI: `apps/chrome-extension/src/options/ProviderForm.tsx`, `apps/chrome-extension/src/options/App.tsx`
- Context window: `packages/llm-client/src/types.ts` (`ProviderConfig.contextWindow`, `DEFAULT_CONTEXT_WINDOW`) — edited in the provider form, used by the Side Panel usage meter
- Side Panel model switcher (grouped by provider, opens upward): `apps/chrome-extension/src/sidepanel/components/ModelPicker.tsx`

## Permissions, message routing, and injection

- Message constants: `apps/chrome-extension/src/shared/index.ts` (`MESSAGE_TYPES`, `BROWSER_ACTION_MESSAGE_TYPES`)
- Service Worker: `apps/chrome-extension/src/background/index.ts`
- Site permissions: `apps/chrome-extension/src/shared/permissions.ts`
- Manifest: `apps/chrome-extension/manifest.config.ts`

## Confirmation, checkpoints, and recovery

- Types: `packages/agent-core/src/types.ts` (`ConfirmationRequest`, `AgentCheckpoint`)
- Storage: `apps/chrome-extension/src/shared/checkpoint-storage.ts`

## Context injection and built-in commands

- Session memory block (previous-run ledger + digest) assembled before every request and placed after history, before the new user message: `apps/chrome-extension/src/sidepanel/memory-assembly.ts` (`buildSessionMemory`, `loadSessionMemory`, `selectPreviousRun`)
- `/` built-in commands (`/compact`, `/memory`, `/help`, `/clear`): `apps/chrome-extension/src/sidepanel/slash-commands.ts` (`parseSlashCommand`, `runSlashCommand`, `SLASH_COMMANDS`) — intercepted before the provider check; never sent to the model or billed, and their notice cards are persisted as session messages but filtered out of model context
- Tool-result hard truncation before entering context: `packages/agent-core/src/loop.ts` (`buildToolContent`, `READ_FILE_CONTENT_LIMIT`, `DEFAULT_TOOL_CONTENT_LIMIT`)
- Session digest fields and `/compact` writes: `apps/chrome-extension/src/shared/session-storage.ts` (`SessionRecord.digest`, `saveSessionDigest`, `digestThroughMessageId`)
- `round_limit` results return `pendingCalls` / `signatures` and synthesize their own `tool` replies: `packages/agent-core/src/loop.ts` (`runAgentLoop`)
