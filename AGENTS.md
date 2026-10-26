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

## Verification expectations

Before reporting work as complete:

```bash
pnpm typecheck
pnpm build
```

Then confirm `apps/chrome-extension/dist/manifest.json` still declares the expected permissions and entry points. Automated browser tools cannot open `chrome://extensions`, so loading the unpacked extension is a manual step — state that explicitly instead of claiming it was verified.
