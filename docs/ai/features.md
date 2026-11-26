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
- Header (HUD): brand mark + session title, then rename / new / delete `IconButton`s, the run status pill (`sidepanel.statusRunning` / `statusAwaiting`, only while active) and the settings `IconButton`. The title is capped at `TITLE_MAX_WIDTH` so the action icons always fit
- Session menu content: `apps/chrome-extension/src/sidepanel/components/SessionMenu.tsx` — search box (from five sessions up) and one row per session with switch + per-row delete on the right. Creating, renaming and deleting the active session live in the header; clearing is the `/clear` command and task records stay behind the right-edge pull tab
- Session rename: `renameSession` in `apps/chrome-extension/src/shared/session-storage.ts` (deliberately leaves `updatedAt` alone so renaming does not reorder the list), driven by `renameDraft` state in `App.tsx` through the shared `Dialog` + `Input`
- Session actions live in the header menu, not in a toolbar row — `apps/chrome-extension/src/ui/Menu.tsx` (`Dropdown`, `MenuItem`)
- Composer: one-line `TextArea` that grows to `COMPOSER_MAX_HEIGHT`, then a control row with `ModelPicker`, the confirm/auto `Segmented`, the attach `IconButton` and send/stop
- Context strip under the composer: current-page chip (turns `danger` and grants permission on click when `pendingPageOrigin` matches the tab), one removable chip per bound file, and the compact `UsageMeter`
- Side-effect approval bar sits just above the composer (`pendingConfirmation`) so confirmations do not push the transcript
- Chat and task-history panes overlap and slide with `transform` inside an `overflow: clip` container, and the off-screen pane is `inert`. Do not change that back to `overflow: hidden`: a hidden-but-scrollable container lets focus scroll the pane sideways, which pushes the chat off-screen to the left
- Empty state (no provider / no messages) and loading rows use the shared `EmptyState` / `LoadingRow` primitives; when the active tab is an `http(s)` page the empty state offers three page-aware tasks (translate into the UI language / summarise / turn into a table) that send straight away. Suggestion text lives in `sidepanel.suggest*` in `apps/chrome-extension/src/shared/i18n.ts`
- Usage meter: `apps/chrome-extension/src/sidepanel/components/UsageMeter.tsx` — compact bar + percentage, details on hover
- System prompt and task policies: `apps/chrome-extension/src/sidepanel/App.tsx` (`SYSTEM_PROMPT`) — page translation defaults to in-place DOM edits unless the user asks for a chat reply; file exports are batched into one deliverable per request (reuse the filename on a later update, split only on explicit request or oversized content)
- Task history: `apps/chrome-extension/src/sidepanel/TaskHistory.tsx` — reads only the active session (`listSessionTasks(sessionId)`), shows the session title in its header, drops stale results when the session is switched mid-read, and offers a `定位` action that jumps back to that run in the conversation (messages carry `id="run-<taskId>"`, see `runAnchorId` in `App.tsx`; only runs whose message still exists get the button)
- Run block (one per assistant reply): `apps/chrome-extension/src/sidepanel/components/RunBlock.tsx` — collapsed shows status · step count · duration; expanding shows the step timeline. Uses live `toolEvents` while streaming and `listTaskSteps(taskId)` afterwards. The last reply also gets a `重新生成` action: `handleSend(..., { assistantId })` removes that answer (`deleteSessionMessage`) and re-runs the same user message without appending a duplicate
- Interrupted-run recovery: the checkpoint banner offers `继续` (`handleResumeInterrupted` clears the checkpoint and sends `sidepanel.resumeTask` as a new turn in the same session, relying on the transcript plus the run ledger instead of replaying raw loop state) or `清除`
- Reply-to-task link: `SessionMessageRecord.taskId` (`apps/chrome-extension/src/shared/session-storage.ts`) is written with the assistant message so the run block survives a reload; older records simply render without one
- Task summaries for run blocks (step count / duration) are cached per session in `App.tsx` (`refreshSessionTasks` ← `listSessionTasks`)
- Message bubble and message actions (copy / edit-and-resend): `apps/chrome-extension/src/sidepanel/components/MessageBubble.tsx` — assistant text renders through Markdown, user text stays plain with preserved newlines; actions appear on hover or keyboard focus; replies containing a table use the full bubble width
- Markdown rendering: `apps/chrome-extension/src/ui/Markdown.tsx` (blocks + inline, fenced code with language label and copy, lists, quotes, rules, tables) on top of the pure parser in `apps/chrome-extension/src/ui/markdown-parse.ts`, unit-tested in `apps/chrome-extension/src/ui/markdown-parse.test.ts`. Rendering builds React elements only — never `innerHTML` — and links are limited to `http(s)` / `mailto`. Tables shrink to the bubble width first, then scroll horizontally with a sticky first column and a hint line; long unbreakable tokens wrap instead of widening the table
- Step row (used inside the run block): `apps/chrome-extension/src/sidepanel/components/ToolEventItem.tsx`

## Interface language (zh / en)

- Message tables and resolution: `apps/chrome-extension/src/shared/i18n.ts` (`translate`, `resolveLang`, `detectLang`, `UI_LANGUAGE_KEY`)
- React binding and language switcher state: `apps/chrome-extension/src/shared/useI18n.ts` (`useI18n`)
- Manifest-level strings (name, store description, toolbar tooltip): `apps/chrome-extension/public/_locales/`, `apps/chrome-extension/manifest.config.ts` (`default_locale`)
- Language picker (Settings → 通用): `apps/chrome-extension/src/options/App.tsx` (`GeneralPanel`)
- Task text in the UI (history cards, tool-call cards, message bubbles, banners, confirm dialogs) all go through `t()`; dynamic strings use `useI18n()`
- Deliberately not localized: tool-result messages returned to the model in `apps/chrome-extension/src/background/index.ts` and `apps/chrome-extension/src/sidepanel/file-tools.ts` — the model reads them, they are not rendered as UI

## UI components and design tokens

- Design tokens (numeric scales: radius, font size/weight, spacing, control size, shadow, motion, z-index, icon size): `apps/chrome-extension/src/ui/tokens.ts`
- Color tokens are CSS variables, not literals: `apps/chrome-extension/src/ui/theme.css` (`--wc-*`) — light/dark via `light-dark()`, plus `:focus-visible` ring, `.ui-button` hover/active states, spinner and skeleton keyframes. `tokens.ts` only references `var(--wc-*)`, so every component is theme-aware without changes
- Shared primitives: `apps/chrome-extension/src/ui/` — Button, IconButton, Icon, Input, TextArea, Select, Checkbox, Field, Alert, Card, Badge, Tooltip, Spinner/LoadingRow, Skeleton/SkeletonLines, EmptyState, Dialog, Dropdown/MenuItem, Segmented, Chip, Markdown
- Wide layout: the content area measures itself with a `ResizeObserver` (state `contentWidth`, `WIDE_BREAKPOINT = 600` in `App.tsx`); from 600px up the task records stop sliding over the chat and sit in a permanent right column (`asideWidth` = 36% clamped to 280–340px), both pull tabs disappear, and `view` is reset to `chat` so shrinking the panel again does not leave the chat hidden
- Command palette (`⌘K` on macOS, `Ctrl+K` elsewhere): `apps/chrome-extension/src/sidepanel/components/CommandPalette.tsx` — App builds the action list (sessions, `/` commands, providers, panel actions) and the palette only filters, moves the selection and runs one; it steps aside while a dialog is open and always closes before running, and the empty state prints the shortcut so the feature is discoverable
- Hover hints all go through the shared `Tooltip` (`apps/chrome-extension/src/ui/Tooltip.tsx`), never the native `title`: it portals to the body, mounts only on first open, clamps itself to the viewport, flips to the other side when the preferred side has no room (so it never covers its own trigger) and keeps `aria-label` on the control as the accessible name
- Component prop conventions and override rules: `apps/chrome-extension/src/ui/index.ts`
- Settings-page layout styles: `apps/chrome-extension/src/options/styles.ts`

## Brand assets

- Extension icons (16/32/48/128, downscaled from the 1024px source artwork): `apps/chrome-extension/public/icons/`
- Manifest declarations (`icons` + `action.default_icon`): `apps/chrome-extension/manifest.config.ts`
- In-app brand mark (side panel header, settings sidebar) references `/icons/icon-48.png` from `apps/chrome-extension/src/sidepanel/App.tsx` and `apps/chrome-extension/src/options/App.tsx`; the settings tab favicon is set in `apps/chrome-extension/src/options/index.html`

## Appearance and theme preference

- Preference storage and DOM switch: `apps/chrome-extension/src/shared/theme.ts` (`ThemePref`, `UI_THEME_KEY`, `applyTheme`) — `auto` removes `<html data-theme>`, `light`/`dark` set it
- React binding: `apps/chrome-extension/src/shared/useTheme.ts` (`useTheme` for the settings picker, `useApplyTheme` for pages that only need it applied) — module-level store + `chrome.storage.local` change listener + `matchMedia` listener
- Theme picker (Settings → 通用 → 外观): `apps/chrome-extension/src/options/App.tsx` (`GeneralPanel`)
- Entry stylesheet import (both pages): `apps/chrome-extension/src/sidepanel/main.tsx`, `apps/chrome-extension/src/options/main.tsx`

## In-app confirmation dialog

- Promise-based `confirm()` and the single `ConfirmHost`: `apps/chrome-extension/src/shared/confirm.tsx` — replaces every `window.confirm`, mounted next to `App` in both entry points
- Dialog shell (scrim, Esc, focus trap, restore focus): `apps/chrome-extension/src/ui/Dialog.tsx`


## Sessions and task history storage

- Sessions: `apps/chrome-extension/src/shared/session-storage.ts` (`SessionRecord`, `listSessions`)
- Session usage totals: `apps/chrome-extension/src/shared/session-storage.ts` (`addSessionUsage`, `inputTokens`, `outputTokens`) — cumulative per session, reset when the session messages are cleared
- Step logs: `apps/chrome-extension/src/shared/step-log-storage.ts` (`recordStep`, `listSessionTasks`, `pruneLogs`)
- Chat records: `apps/chrome-extension/src/shared/chat-storage.ts`
- IndexedDB setup: `apps/chrome-extension/src/shared/local-db.ts`

## Session-scoped local files

- File handle storage: `apps/chrome-extension/src/shared/file-handle-store.ts` (`bindFile`, `bindFileHandle`, `listBoundFiles`, `unbindFile`, `deleteSessionFiles`) — key is `${session_id}::${name}` with a `by_sessionId` index; the v5 DB upgrade recreates the store and drops legacy global bindings (no migration)
- File tools: `apps/chrome-extension/src/sidepanel/file-tools.ts` (`createFileTools(sessionId)`) — `list_bound_files` and every read/write are limited to files bound to the current session
- Side Panel UI: bound files are chips in the context strip under the composer (hidden when none), and the attach icon opens the system picker directly; dropping files onto the chat panel or composer binds them to the current session through `DataTransferItem.getAsFileSystemHandle()`
- File preview (first slice of the artifacts surface): `apps/chrome-extension/src/sidepanel/components/FilePreview.tsx` — clicking a file chip reads the bound handle, shows the first 200 lines / 12k characters in a dialog, and reports binary files or a revoked permission instead of failing silently
- Session artifacts: `download_file` calls `appendSessionArtifact` (`apps/chrome-extension/src/shared/session-storage.ts`), so `SessionRecord.artifacts` keeps **metadata only** — name, byte count, `chrome.downloads` id and time, capped at 50 and de-duplicated by name. File content is never copied into IndexedDB; the file itself stays in the Downloads folder, which is what keeps history from growing with every export. The data URL MIME is derived from the target extension (`mimeForDownload` in `apps/chrome-extension/src/sidepanel/file-tools.ts`), because Chrome rewrites the download extension from the MIME — `text/plain` turns `report.md` into `report.txt`; `resolveDownloadName` also appends `.md` when the model omits an extension and replaces generic stems such as "下载" with the session title, while the artifact name comes from `chrome.downloads.search`, i.e. the file name actually written to disk
- Artifact list: `apps/chrome-extension/src/sidepanel/components/ArtifactList.tsx` — shown above the task records (both the wide right column and the slide-over) with a `显示` action that calls `chrome.downloads.show`, falling back to the Downloads folder when that download is gone
- Display formatting shared by the panel and dialogs: `apps/chrome-extension/src/shared/format.ts` (`formatFileSize`, `formatDateTime`)

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
- Recovery semantics: the checkpoint keeps the raw loop messages but the UI never replays them; resuming sends a continue instruction as a normal turn and the model reconstructs state from the transcript, the session memory ledger and the current page
- Regenerate: `deleteSessionMessage` in `apps/chrome-extension/src/shared/session-storage.ts` removes a single reply (and adjusts `messageCount`) so the same prompt can run again without leaving two answers

## Context injection and built-in commands

- Session memory block (previous-run ledger + digest) assembled before every request and placed after history, before the new user message: `apps/chrome-extension/src/sidepanel/memory-assembly.ts` (`buildSessionMemory`, `loadSessionMemory`, `selectPreviousRun`)
- `/` built-in commands (`/compact`, `/memory`, `/help`, `/clear`): `apps/chrome-extension/src/sidepanel/slash-commands.ts` (`parseSlashCommand`, `runSlashCommand`, `SLASH_COMMANDS`) — intercepted before the provider check; never sent to the model or billed, and their notice cards are persisted as session messages but filtered out of model context
- Tool-result hard truncation before entering context: `packages/agent-core/src/loop.ts` (`buildToolContent`, `READ_FILE_CONTENT_LIMIT`, `DEFAULT_TOOL_CONTENT_LIMIT`)
- Session digest fields and `/compact` writes: `apps/chrome-extension/src/shared/session-storage.ts` (`SessionRecord.digest`, `saveSessionDigest`, `digestThroughMessageId`, `contextTokens` / `saveSessionContextTokens` for the context meter)
- `round_limit` results return `pendingCalls` / `signatures` and synthesize their own `tool` replies: `packages/agent-core/src/loop.ts` (`runAgentLoop`)
