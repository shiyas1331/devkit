---
description: Print coverage delta against baseline plus latent bugs flagged in earlier runs.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:report — coverage delta + latent bug summary

Equivalent to `/devkit:cover <path> --report`. Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"Package path? (e.g. packages/establishment)"`.

## Execute

Run **Mode E (`--report`)** from `commands/cover.md`:

1. Detect platform.
2. Run `npm test -- --coverage` (only if `.coverage-baseline.json` exists or user explicitly opts in).
3. Compare against baseline.
4. Read `.claude/memory/<package>-latent-bugs.md` (or `latent-bugs.md` fallback) for accumulated findings.
5. Print coverage delta + latent bug count + next suggested work.

For the full pipeline, see `commands/cover.md` → "Mode E".

## Guardrails

- Read-only. Never modifies files.
