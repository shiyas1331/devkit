---
description: Show the verbose flag reference for /devkit:pr-review.
argument-hint: (none)
model: opus
---

# /devkit:pr-review:help — verbose flag reference

Equivalent to `/devkit:pr-review --help` (or `-h`, or `?` as a standalone token).

## Execute

1. Locate the help reference at `<plugin-root>/references/help/pr-review.md`.
2. Read it.
3. Print the **"Verbose flag reference"** section verbatim. Includes `--depth=quick`, `--focus=<glob>`, `--since=<commit>`, `--save`, `--save=<path>`, `--post`, `--post-review`, `--bulk-confirm`, `--no-jira`.
4. STOP. The user reads, then re-invokes with concrete args.

## Guardrails

- Read-only. Never modifies files.
