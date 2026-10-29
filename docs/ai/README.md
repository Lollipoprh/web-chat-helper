# AI Code Index

An on-demand code index for AI agents. `AGENTS.md` contains the entry points; the details live here.

## Reading order

1. Feature request: use `features.md` to find the relevant files.
2. Product wording does not match a code identifier: use `glossary.md`.
3. Symbols, line numbers, or references: use the relevant file in `codemap/`.
4. Architectural decisions: check `docs/adr/` if it exists.

Once you have a path and line number, read only that section of the source file. Avoid reading large files in full.

## Line budget

Keep `AGENTS.md` at 130 lines or fewer, `features.md` at 150 lines or fewer, each codemap file at 200 lines or fewer, and all codemap files at 900 lines or fewer.
A cold start should need roughly 400 lines across `AGENTS.md`, `features.md`, and two relevant source sections.

## Handwritten and generated files

- Maintain `README.md`, `features.md`, and `glossary.md` by hand.
- Generate `codemap/` with `pnpm map`; do not edit its files manually.
- Check generated content with `pnpm map:check`.
- Check file references with `pnpm docs:check`.

## Maintenance

Update `features.md` when a change adds a product concept or changes a module's responsibility. Update `glossary.md` when product wording changes. Run `pnpm verify` before finishing.
