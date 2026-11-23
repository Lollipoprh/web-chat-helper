# Compatibility policy

What 1.x promises, and what may still change without a major version bump.

This repository ships a Chrome extension, not a library, so "public API" here means the things a
user or another tool can depend on: stored data, cross-context messages, tool contracts, and the
export format.

## Public surfaces

| Surface | Where | 1.x promise |
|---|---|---|
| IndexedDB schema (`web-chat-helper`) | `apps/chrome-extension/src/shared/local-db.ts` | Additive only. Version bumps migrate in place; existing sessions, messages, task logs, steps and file handles are never dropped. |
| `chrome.storage.local` keys | `shared/storage.ts`, `checkpoint-storage.ts`, `theme.ts` | Existing keys keep their meaning. New keys are optional and defaulted when absent. |
| Cross-context messages | `shared/index.ts` message constants | Add-only: new message types may appear, existing types keep their payload shape. |
| Tool names and arguments | `sidepanel/browser-tools.ts`, `sidepanel/file-tools.ts`, `packages/browser-tools` | An existing tool keeps its name and the meaning of its required arguments. New **optional** arguments and new tools may be added. |
| Session export format | `docs/ai/features.md` → export/import (planned) | Carries a `version` field; readers accept older versions and reject newer ones with a clear message. |
| Provider config shape | `shared/storage.ts` (`ProviderConfig`) | Existing fields keep their meaning; new fields are optional. |

## Changes that are NOT breaking

- UI layout, wording, icons, animations, density
- Prompt text, tool descriptions, tool ordering
- i18n keys and their translations (internal only)
- Internal module structure, file names, package boundaries
- New tools, new optional tool arguments, new optional config fields
- New permissions — except that a new **required** host permission is announced in release notes,
  because it changes the install/update consent prompt
- Token accounting details (they are estimates)

## Breaking changes

A breaking change is a change that makes previously stored data unusable or changes what an
existing call means. Those require a major version, and the release notes must contain a
`### Migration` section that says what happens to existing data and what the user must do.

If the change can be avoided by reading both shapes, do that instead — migration code is cheaper
than losing a user's history. Fields are removed only after at least one minor release in which
they are marked deprecated in `docs/ai/features.md`.

## Data durability rules

1. IndexedDB upgrades go through `onupgradeneeded` and are **additive**; a failed upgrade must
   leave the old version readable rather than half-migrated.
2. Never delete a user's sessions or task logs as part of a feature migration.
3. File handles are best-effort: a handle may lose permission after a browser restart or a file
   move. Features must degrade to "bind it again", never to a silent empty result.
4. Artifacts store metadata only. Download contents are never copied into extension storage.
5. API keys stay encrypted at rest (AES-GCM with a PBKDF2-derived key); plaintext keys written by
   older versions are read once and re-encrypted on the next save.

## Stability beyond 1.x

The agent loop stays in the Side Panel, the content script never sees an API key, and the model
never gets a generic "run JavaScript in the page" tool. Those are architectural invariants, not
versioned promises: they are not going to change in a minor release, and changing them would be a
product decision recorded in `docs/adr/`.
