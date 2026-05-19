---
description: Show the verbose flag reference for /devkit:cover. Use when you want full flag documentation.
argument-hint: (none)
model: opus
---

# /devkit:cover:help — verbose flag reference

Equivalent to `/devkit:cover --help` (or `-h`, or `?` as a standalone token).

## Execute

1. Locate the help reference at `<plugin-root>/references/help/cover.md`.
2. Read it.
3. Print the **"Verbose flag reference"** section verbatim.
4. STOP. The user reads, then re-invokes with concrete args.

## Guardrails

- Read-only. Never modifies files.
- DO NOT run discover or write tests from this mode.
