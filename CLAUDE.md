# CLAUDE.md

The canonical, tool-agnostic guidance for this repo lives in **[`AGENTS.md`](./AGENTS.md)**. It is imported below — treat it as the source of truth.

@AGENTS.md

## Claude-specific notes

- On Windows, never round-trip a source file through PowerShell (`Get-Content -Raw` then `Set-Content`): PowerShell's default encoding mangles UTF-8 characters (`×`, `°`, `—`, `§`) and prepends a BOM. Use the dedicated Edit/Write tools or Node scripts with explicit `"utf8"`.
- Always run `npm run verify` and `npm run test:browser` before considering a task done.
- When creating any new `.ts`, `.js`, or `.mjs` file, apply the LGPL-3.0-or-later header via the [`license-header-adder`](./.agents/skills/license-header-adder/SKILL.md) skill (`node scripts/check-license-headers.mjs --write`).
