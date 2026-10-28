# Web Chat Helper

[中文说明](README-CN.md)

A Chrome extension AI assistant that reads and operates the current web page. It talks to any **OpenAI-compatible** Chat Completions API, so you bring your own provider, model, and API key.

The extension is a pure Manifest V3 Chrome extension — no backend, no local server, no Playwright or CDP.

## Features

- **Side Panel chat UI** — task input, streaming output, stop button, multiple persisted sessions (new / switch / delete) with task history.
- **Provider settings page** — add / edit / delete / select providers (Base URL, API Key, Model, streaming and tool-call switches) plus a connection test.
- **LLM client** — OpenAI-compatible Chat Completions, non-streaming and SSE streaming, multi-turn context, timeouts and cancellation.
- **Agent loop** — tool-call parsing, argument validation, bounded rounds (50 by default), duplicate-call detection, execution logs.
- **Browser tools** — 14 tools: page reading, element lookup, click, fill, scroll, wait, verify, navigation, select, plus tab management (list / new / switch / close).
- **Safety** — full-site HTTPS access at load (`host_permissions`), on-demand access for local HTTP, user confirmation for side-effecting actions, cancellation, interrupted-task marking.

Out of scope: Playwright/CDP automation, a standalone backend, MCP, multi-agent orchestration, long-term memory and full visual automation.

## Requirements

- Node.js >= 18 (developed against v24)
- pnpm 12
- Chrome 114+ (Side Panel API)

## Install

```bash
pnpm install
```

If `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS`, make sure `allowBuilds` in `pnpm-workspace.yaml` still allows `esbuild` — the build chain needs its platform binary.

## Develop

```bash
pnpm dev        # Vite dev server with CRXJS hot reload
pnpm typecheck  # tsc --noEmit across all workspace packages
pnpm test       # Vitest unit tests for llm-client and agent-core
pnpm build      # production build of the extension into apps/chrome-extension/dist
```

To load the extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `apps/chrome-extension/dist`

Clicking the toolbar icon opens the Side Panel for the current tab. Opening the extension's options page gives you the provider settings.

## Project layout

```
web-chat-helper/
├── apps/chrome-extension/        # Manifest V3 extension (Vite + React + CRXJS)
│   ├── manifest.config.ts        # defineManifest() — permissions, entries, side panel
│   ├── vite.config.ts
│   └── src/
│       ├── sidepanel/            # Side Panel UI — hosts the agent loop
│       ├── options/              # Provider settings page
│       ├── background/           # Service worker — tabs, permissions, message routing
│       ├── content/              # Content script — DOM reading and actions
│       └── shared/               # Cross-context types and message constants
└── packages/
    ├── llm-client/               # OpenAI-compatible client (streaming, tool calls)
    ├── agent-core/               # Agent loop, tool registry, limits, logging
    └── browser-tools/            # Browser automation tools
```

Currently `packages/*` expose TypeScript sources as their entry points, so Vite bundles them directly. `llm-client` already implements provider types, endpoint normalization and the connection test; the rest are still typed shells.

## Runtime architecture

```
User → Side Panel (agent loop)
          ├── llm-client   → user-configured OpenAI-compatible endpoint
          ├── agent-core   → validation, limits, logging, cancellation
          └── browser-tools → Service Worker → Content Script → DOM
```

Three rules shape the design:

1. **The agent loop lives in the Side Panel**, not the service worker — MV3 service workers are suspended when idle, which kills long-running loops.
2. **The content script never sees the API key.** Only the Side Panel talks to the model.
3. **DOM references are never persisted.** Every action re-locates its target, so navigation and SPA route changes fail safely instead of acting on stale nodes.

## Status

All core features are implemented: side-effecting tools require explicit user confirmation, abort signals propagate through model requests / in-flight tools / pending confirmations, per-round checkpoint persistence survives Side Panel close or extension restart, and the interrupted-task banner never auto-replays side-effect steps.

## License

Apache License 2.0 — see [LICENSE.txt](LICENSE.txt).
