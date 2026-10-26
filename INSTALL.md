# Web Chat Helper —— Installation & Verification Guide

[中文版本](INSTALL-CN.md)

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Chrome 116+ | Relies on the Side Panel API (introduced in Chrome 114, stable from 116) |
| pnpm 12 | Build tool. First time: `npm install -g pnpm@12` |
| Model provider | Any service that speaks the OpenAI Chat Completions protocol: official, DeepSeek, Doubao (Volcengine), Moonshot, local Ollama, etc. |
| Provider API key | Apply at your provider's console. The extension sends requests **only from the Side Panel** — never through the Service Worker or Content Script. |

> This extension has **no runtime dependency** on the Node.js runtime, CDP, Playwright, MCP, or any local service. Load the built directory and it works.

## 2. Installing from source (load-unpacked)

```bash
# 1. Clone the repo
git clone <repo-url> web-chat-helper
cd web-chat-helper

# 2. Install dependencies (first time only)
pnpm install

# 3. Production build
pnpm build
# Output: apps/chrome-extension/dist/
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** in the top-right
3. Click **Load unpacked** and choose the `apps/chrome-extension/dist/` directory
4. A 🛠 icon appears in the toolbar. Right-click → **Options**, or open the side panel directly to configure.

> **Note**: Do **not** use **Pack extension** to generate a `.crx`. The extension uses a Service Worker module with CRXJS dynamic chunks; load-unpacked is the stable way to run it.

## 3. Configure a provider

1. Open the side panel (click the toolbar icon)
2. Click **Settings** in the top-right
3. Fill in four fields:
   - **Provider name**: anything, used only for display
   - **Base URL**: a Chat Completions-compatible endpoint, e.g.
     - Official OpenAI: `https://api.openai.com/v1`
     - DeepSeek: `https://api.deepseek.com/v1`
     - Doubao / Volcengine: `https://ark.cn-beijing.volces.com/api/v3`
     - Local Ollama: `http://localhost:11434/v1`
   - **API Key**: the secret issued by your provider
   - **Model name**: e.g. `gpt-4o-mini`, `deepseek-chat`, `doubao-pro-32k`
4. Click **Test connection**. Success shows a green hint; failures show the reason (network error / 401 invalid key / 402 quota exceeded, etc.).

**What "402" means**: your provider account has run out of quota. Recharge or switch to a new key. The error is shown inline in Chinese.

## 4. Test matrix

Run each item below, check ✅ for pass, write a short note for fail. **Start with an ordinary HTTPS page** (news site, product landing) — avoid pages that require login.

### Core scenarios

| # | Scenario | Steps | Pass criteria | Result | Notes |
|---|---|---|---|---|---|
| 1 | Install & setup | load-unpacked → add provider → test connection | Extension loads; provider can be saved/edited/switched; connection test gives clear feedback | ☐ Pass ☐ Fail | |
| 2 | Plain chat (no browser tools) | Send a text question, e.g. "What can you do?" | Model replies normally; streaming has a typing effect; Stop button is responsive | ☐ Pass ☐ Fail | |
| 3 | Page read | Open any HTTPS page → send "Summarize this page" | Model calls `get_page_snapshot`; result includes title, URL, visible main text (passwords / sensitive fields excluded) | ☐ Pass ☐ Fail | |
| 4 | Page action (read-only) | Open a page with a search box → send "Search for a keyword" | Model calls `find_elements` / `click_element` (the search box) → confirmation dialog appears | ☐ Pass ☐ Fail | |
| 5 | Confirmation gate | Let the model run `click_element` or `fill_input` | Side panel shows an orange **Awaiting confirmation** dialog with redacted args; after **Reject** the model receives `needs_confirmation` and adjusts strategy; after **Approve** the action runs | ☐ Pass ☐ Fail | |
| 6 | Page verification | Click the search button → model **must** call `verify_action` to confirm | verify returns success or an explicit failure; model never assumes success | ☐ Pass ☐ Fail | |
| 7 | Page navigation / stale refs | Click a link on page A → land on page B → observe | Old refs return `stale_element` from the Content Script; nothing is mis-clicked on the new page | ☐ Pass ☐ Fail | |
| 8 | Protected pages blocked | Open a `chrome://`, `chrome-extension://`, or `edge://` page → send a task | Tools return `unsupported_page`; Content Script is **not** injected | ☐ Pass ☐ Fail | |
| 9 | Cancel / Stop | Hit Stop while a task is running | In-flight model request aborts; running tools cancel; the pending confirmation dialog closes immediately; final status says **Cancelled** | ☐ Pass ☐ Fail | |
| 10 | Lifecycle (interrupted) | Start a task → close the side panel → reopen | Top banner says **Last task was interrupted (round N)**; side-effect steps are **not auto-replayed**; Clear button removes the banner | ☐ Pass ☐ Fail | |

### Failure-path spot checks

| # | Scenario | Action | Expected | Result |
|---|---|---|---|---|
| F1 | Invalid API key | Deliberately put the wrong key → Test connection | 401 → clear error hint | ☐ |
| F2 | Wrong base URL | Set `https://example.com` | Test fails with "URL is not Chat Completions compatible" | ☐ |
| F3 | Timeout | Disconnect network → send a task | Request times out, returns timeout error | ☐ |
| F4 | Permission denied | Click **Reject** when the site-permission popup appears | Tools return `not_authorized`; red banner + one-click authorize button | ☐ |
| F5 | Missing element | Let the model look for something that doesn't exist | `element_not_found` → model should pivot | ☐ |
| F6 | Duplicate-call guard | Let the model click the same element twice with identical args | Second call is skipped with `duplicate_call` | ☐ |
| F7 | 402 quota exceeded | Test with an exhausted key | Chinese message: "account quota exceeded, recharge or switch API key" | ☐ |

## 5. First manual pass (suggested order)

Running through these in sequence covers most paths:

1. ☐ Add a provider and send a plain-text question
2. ☐ Test streaming output; click Stop halfway
3. ☐ Ask the AI to summarize the current web page (page read)
4. ☐ Ask the AI to find the search box → fill in a keyword → **click Submit** (confirmation dialog should pop) → Approve → read the results
5. ☐ Ask the AI to search a second keyword → **Reject** confirmation → watch whether the model adjusts strategy
6. ☐ Test with a wrong API key → verify the error message is clear

## 6. Diagnostics & logging

### Where logs live
While the Side Panel Agent Loop runs, structured tool-call logs are emitted via `console.debug` to the **Side Panel DevTools Console**. Open it: right-click the toolbar icon → **Inspect** → the side panel view.

### Redaction rules
Tool arguments in logs go through three layers of sanitization:
- **Sensitive key replacement**: any key whose name matches `api_key`, `token`, `secret`, `password`, `authorization` is replaced with `***`
- **Long-text truncation**: strings over 120 chars, arrays over 20 items, or objects deeper than 4 levels are truncated
- **Final preview cap**: the whole preview string is cut if it exceeds 300 chars

Example output:
```
[agent] { taskId: 'xxx', round: 1, toolName: 'find_elements', argsRedacted: '{"query":"submit"}', ok: true, durationMs: 85 }
```

### Failure triage checklist
When you hit a P0 issue, collect evidence in this order:

1. Copy the full `[agent]` lines (including errors) from the Side Panel Console
2. Side Panel Network tab → find the `chat/completions` request to your provider → note the status code and the **first 500 characters** of the response body (**do not** paste the full API key — it is in the Request Headers)
3. Record the tool name, error code (`not_authorized` / `element_not_found` / `stale_element` / `unsupported_page` / `needs_confirmation`, etc.), and the page URL

## 7. FAQ

### Q: Why does Chrome pop a permission prompt when I send a task?
The extension uses **on-demand permissions**. It requests no host permission at install time — the first task against a site asks for `host_permissions` covering both your model provider URL and the current page URL. The Content Script is injected only after you grant the site.

### Q: Why can't I operate a specific page?
Three possibilities:
1. **Protected page**: `chrome://`, `chrome-extension://`, `edge://`, and `view-source:` URLs don't allow extensions to inject scripts. Tool calls return `unsupported_page`.
2. **Not authorized yet**: red banner "Current page is not authorized" → click **Authorize current site** or resend the task (which triggers the popup again).
3. **Site CSP blocks the script**: a handful of sites (Google Search, Google Docs, etc.) block extension scripts via Content Security Policy. Switch to a regular page for testing.

### Q: Why isn't the Content Script auto-injected?
The manifest uses the **never-matching** placeholder `web-chat-helper.invalid/*`. The Service Worker manually injects via `chrome.scripting.executeScript` after you grant the site. This guarantees no script is exposed to any page at install time.

### Q: Is my API key safe?
- **Sent only from the Side Panel**: Content Script and Service Worker never hold the key.
- **Never hard-coded**: the key is stored in `chrome.storage.local` and wiped when the extension is uninstalled.
- **Logs are redacted**: all tool arguments and request headers go through the redaction pipeline before being written to Console.

### Q: What is the V1 scope?
V1 freezes at 8 browser tools + Agent Loop + confirmation gate + cancellation + checkpoint. Future versions (V2+) may add: long-running cross-tab tasks, visual understanding, more side-effect actions, multi-tab coordination, streaming tools for local Ollama.
