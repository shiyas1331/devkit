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

## Phase 0 — Detect platform

1. List `<plugin-root>/platforms/`.
2. Read each `detect.md`. Set `PLATFORM`, `PLATFORM_ROOT`. Error + STOP if no match.

## Phase 1 — Coverage delta

1. Run `npm test -- --coverage` (only if `.coverage-baseline.json` exists in `<PLATFORM_ROOT>` OR the user explicitly opts in).
2. Compare against the baseline.

## Phase 2 — Latent bugs lookup

Read `.claude/memory/<package>-latent-bugs.md` (or `latent-bugs.md` fallback) for accumulated findings from prior runs.

## Phase 3 — Print

```
📊 Coverage delta — <package>

Baseline: {{ pct }}%   →   Current: {{ pct }}%   (Δ +{{ pct }}pp)

Tests in this package: {{ N }} suites, {{ N }} tests

Latent bugs flagged so far ({{ count }}):
  • <file:line> — <description>

Next suggested work:
  • {{ N }} files remain untested in <classification>
```

## Guardrails

- Read-only. Never modifies files.
- DO NOT spawn `test-engineer` — this mode only reports.
- DO NOT commit.
