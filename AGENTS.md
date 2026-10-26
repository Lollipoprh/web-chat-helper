# AGENTS.md

[中文说明](AGENTS-CN.md)

Guidance for AI coding agents working in this repository.

## What this project is

A pure Manifest V3 Chrome extension that acts as a browser AI assistant. The user types a task in the Side Panel, an OpenAI-compatible model returns tool calls, the extension reads/manipulates the active page, tool results go back to the model, and the model writes the final answer.

No backend, no local server, no Playwright/CDP, no MCP. Only Chrome APIs plus the user's own model endpoint.

## Commands

```bash
pnpm install     # install workspace deps (needs pnpm 12; esbuild must stay in allowBuilds)
pnpm typecheck   # tsc --noEmit for every workspace package — run before you claim work is done
pnpm build       # production build; output: apps/chrome-extension/dist
pnpm dev         # Vite + CRXJS hot reload for manual testing
```

`packages/*` point their `main`/`types` at `src/index.ts`, so Vite and `tsc` consume the TypeScript sources directly — there is no separate package build step and no stale `dist/` inside packages.

## Layout

- `apps/chrome-extension/` — the extension. Four entry points: `src/sidepanel`, `src/options`, `src/background`, `src/content`. `manifest.config.ts` uses `defineManifest()`; entry paths are resolved relative to `apps/chrome-extension/`.
- `packages/llm-client/` — OpenAI-compatible client: endpoint normalization, SSE parsing, tool-call accumulation, cancellation.
- `packages/agent-core/` — agent loop, tool registry, validation, limits, logging.
- `packages/browser-tools/` — browser tool implementations.
- `apps/chrome-extension/src/shared/` — cross-context types and message constants.

The app depends on the three packages using the `workspace:*` protocol.

## Architectural rules (do not violate)

1. **The agent loop runs in the Side Panel.** Never move it into the service worker — MV3 workers are suspended when idle and long loops die there. The worker only does tabs, permissions, injection and message routing.
2. **Content scripts never touch the API key.** Only Side Panel code sends model requests.
3. **Never persist DOM node references.** Re-locate elements before every action; stale references must fail loudly, not silently operate on the wrong node.
4. **Never let the model execute arbitrary JavaScript**, and never expose a generic "run script in page" tool.
5. **Treat page content as untrusted input.** Text on a page must not be able to change the user's goal or escalate tool permissions.
6. **Side-effecting actions require explicit user confirmation** — sending messages, submitting orders, payments, deletions.
7. **Success is evidence, not a status code.** A click returning without error does not mean the task advanced; read DOM/state afterwards.
8. **Tool arguments are validated before execution**, with a hard round cap (10 by default), duplicate-call detection and per-call timeouts.

## Conventions

- TypeScript strict everywhere. No `any` in new code; prefer explicit types from `src/shared` and the workspace packages.
- All user-facing UI text is Chinese; code, comments, identifiers and commit messages are English. Keep new UI strings consistent with existing ones.
- Business logic must not hardcode any provider URL, model name or key. Providers are user data in `chrome.storage.local`.
- Use `chrome.storage.local` for provider config; never log secrets — redact keys and tool arguments in logs.
- Message passing between contexts goes through `chrome.runtime` messaging with the constants in `src/shared/index.ts`. Add new message types there rather than inventing inline strings.
- Keep `manifest.config.ts` permissions minimal. Add host access through `optional_host_permissions` and request it on user gesture, not on install.
- PowerShell on Windows: create directories with `New-Item -ItemType Directory -Force`, avoid `mkdir -p`, brace expansion and `&&` chaining.

## Implementation status

- Phase 1 — scaffolding: **done** (build, typecheck, unpacked load).
- Phase 2 — provider settings page, `chrome.storage.local` persistence, endpoint normalization, connection test: **implemented**, manual load test pending.
- Phase 3 — Chat Completions client (non-streaming, SSE streaming, cancellation) and chat UI with persisted history: **implemented**, manual load test pending.
- Phase 4 — agent loop, tool registry, JSON-Schema-subset validation, tool-call accumulation (streamed fragments merged by index), round cap, duplicate-call guard, redacted logs: **implemented**, manual load test pending. The `echo` diagnostic tool still exists in `agent-core` but is no longer registered.
- Phase 5 — browser tools, in order: `get_active_tab`, `get_page_snapshot`, `find_elements`, `click_element`/`fill_input`/`scroll_page`, `wait_for_element`/`verify_action`: **implemented**, manual load test pending. The Side Panel registers all eight tools and binds each task to the active tab at send time. `packages/browser-tools` exposes the tool factories and a transport interface; the extension implements the transport, the Service Worker routes/authorizes/injects, and the Content Script performs DOM work. Content scripts are injected on demand only after the user grants the site (manifest `content_scripts` uses a never-matching placeholder so the build emits the files without auto-injection).
- Phase 6 — permissions, confirmation, cancellation, checkpoints, interrupted-task handling: **implemented**. `click_element` and `fill_input` require explicit user confirmation before execution, with the running tool card marked as awaiting confirmation and a inline confirm/reject dialog showing the redacted args. All tools and in-flight confirmation prompts honour the abort signal from the Side Panel's Stop button. Each completed round persists a checkpoint (`taskId`, full `messages[]`, `rounds`) to a dedicated `agentCheckpoint` storage key; the Side Panel shows a warning banner with the interrupted round on next open and never auto-replays side-effect steps.
- Phase 7 — **in progress**: production build hardened (sourcemap disabled, explicit es2022 target), `INSTALL-CN.md` covers load-unpacked steps, provider setup, a 10-scenario test matrix and diagnostic logging. Waiting for user to execute the real-Chrome test matrix against at least one OpenAI-compatible provider and ordinary HTTPS pages. No Node.js / DSH / CDP / local services required at runtime.

Phase N+1 must not start while phase N fails its acceptance criteria.

## Verification expectations

Before reporting work as complete:

```bash
pnpm typecheck
pnpm build
```

Then confirm `apps/chrome-extension/dist/manifest.json` still declares the expected permissions and entry points. Automated browser tools cannot open `chrome://extensions`, so loading the unpacked extension is a manual step — state that explicitly instead of claiming it was verified.
