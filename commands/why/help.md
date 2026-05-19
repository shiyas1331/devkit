---
description: Show the verbose flag reference for /devkit:why.
argument-hint: (none)
model: opus
---

# /devkit:why:help — verbose flag reference

Equivalent to `/devkit:why --help` (or `-h`, or `?` as a standalone token).

## Execute

1. Locate the help reference at `<plugin-root>/references/help/why.md`.
2. Read it.
3. Print the **"Verbose flag reference"** section verbatim. Includes `--depth=quick`, `--depth=thorough`, `--max-walk=N`, `--json`.
4. STOP. The user reads, then re-invokes with concrete args.

## Guardrails

- Read-only. Never modifies files.
