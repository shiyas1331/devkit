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

## Phase 1 — Coverage

Run jest with coverage in the target package and capture the summary table:

```bash
# react-native:
cd <PLATFORM_ROOT> && npm test -- --coverage 2>&1
# node:
cd <PLATFORM_ROOT> && npx jest --coverage 2>&1
```

- **Current coverage** (the user asking "how much coverage do we have?"): always
  available — read the `% Stmts / % Branch / % Funcs / % Lines` row of jest's
  coverage summary. No baseline required.
- **Delta** (optional): if `.coverage-baseline.json` exists in `<PLATFORM_ROOT>`,
  also compute the change vs baseline. If it doesn't exist, skip the delta and
  offer to write one (`npx jest --coverage --json` snapshot) so future runs can
  show movement.
- Node note: coverage is collected from `src/**` per `collectCoverageFrom` in the
  scaffolded `jest.config.js`. If jest isn't set up yet, tell the user to run
  `/devkit:cover <path> --setup` first.

## Phase 2 — Latent bugs lookup

Read `.claude/memory/<package>-latent-bugs.md` (or `latent-bugs.md` fallback) for accumulated findings from prior runs.

## Phase 3 — Print

```
📊 Coverage — <package>

Current: {{ stmts }}% stmts · {{ branch }}% branch · {{ funcs }}% funcs · {{ lines }}% lines
{{ if baseline exists }}Baseline: {{ pct }}%   →   Δ +{{ pct }}pp{{ endif }}

Tests in this package: {{ N }} suites, {{ N }} tests, {{ pass/fail }}

Lowest-covered files (top 5):
  • <file> — {{ pct }}%

Latent bugs flagged so far ({{ count }}):
  • <file:line> — <description>

Next suggested work:
  • {{ N }} files/methods remain untested in <classification>
    (RN: slices/thunks/hooks…  node: managers/repositories/mappers…)
```

The "lowest-covered files" + "next suggested work" lines turn the raw % into
actionable next batches.

## Guardrails

- Read-only. Never modifies files.
- DO NOT spawn `test-engineer` — this mode only reports.
- DO NOT commit.
