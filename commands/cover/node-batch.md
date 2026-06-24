---
description: Shared body for node batch sub-commands (managers/repositories/mappers/services/util/workers). Not invoked directly.
argument-hint: <package-path> (with CLASSIFICATION set by the caller)
model: opus
---

# /devkit:cover node batch (shared body)

This is the generic batch runner for the **node** platform. The thin
per-classification commands (`managers.md`, `repositories.md`, `mappers.md`,
`services.md`, `util.md`, `workers.md`) delegate here after setting
`CLASSIFICATION`. It mirrors the React Native `slices.md` flow but emits
**one test file per public method** under `tests/unit/`.

## Input

```
$ARGUMENTS            # the package/dir path
CLASSIFICATION        # set by the delegating command: manager|repository|mapper|service|util|worker
```

If `$ARGUMENTS` is empty, prompt: `"Package path? (e.g. content-service or content-service/src/versions/v1/manager)"`.

## Context loading

Read BEFORE doing anything:
1. `CLAUDE.md` in the repo root
2. `.claude/codebase/*.md` (if exists)
3. `.claude/memory/test-patterns.md`
4. `.claude/memory/latent-bugs.md`

## Phase 0 — Detect platform

1. List `<plugin-root>/platforms/` and apply each `detect.md`.
2. Require `PLATFORM==node`. If detection yields a different platform, STOP and
   tell the user this batch is node-only (they likely want the RN batch).
3. Set `PLATFORM_ROOT`, `TEST_DIR=tests/unit`.

## Phase 1 — Discover (silent, filtered to CLASSIFICATION)

Read `<plugin-root>/platforms/node/classifications.md`. Spawn `codebase-locator`
to enumerate every source file under `<PLATFORM_ROOT>/src/**` (and
`<PLATFORM_ROOT>/workers/**` when `CLASSIFICATION==worker`) that:
- matches `CLASSIFICATION` per the node table, AND
- has at least one public method WITHOUT a matching
  `tests/unit/<mirrored-path>/<basename>.<layer>/<method>.test.ts`.

Skip abstract base classes (`base.*.ts`) and pure re-export barrels.

Result: a list of source files (with their untested methods) to cover.

## Phase 2 — Load template + conventions ONCE

1. Read `<plugin-root>/platforms/node/templates/<CLASSIFICATION>.template.md` → `TEMPLATE_CONTENT`
2. Read `<plugin-root>/platforms/node/conventions.md` → `CONVENTIONS_CONTENT`

## Phase 3 — Spawn agents (parallel, pool of 5)

For each source file, spawn one `test-engineer` agent:

```
PLATFORM=node
SOURCE_FILE=<absolute path>
CLASSIFICATION=<CLASSIFICATION>
PACKAGE_ROOT=<PLATFORM_ROOT>
TEST_DIR=tests/unit
EXISTING_FIXTURES=

TEMPLATE:
<paste TEMPLATE_CONTENT verbatim>

CONVENTIONS:
<paste CONVENTIONS_CONTENT verbatim>
```

The agent emits one file per public method and returns them in `test_files`.

## Phase 4 — Aggregate + verify

1. Collect JSON outputs from all agents (use `test_files`, sum `tests_added`).
2. Run `npx jest tests/unit/` once at `<PLATFORM_ROOT>` to verify nothing broke.

## Phase 5 — Report

```
📦 Batch <CLASSIFICATION> — <package>

✅ Passed:        {{ N }} source files / {{ M }} test files / {{ T }} tests
⚠️  Needs human:  {{ N }} files (see below)
⏭️  Skipped:      {{ N }} files (see below)

Latent bugs flagged across batch ({{ count }}):
  P0: {{ N }}    P1: {{ N }}    P2: {{ N }}    P3: {{ N }}
  • <file:line> [P0]: <description>
  • ...

Files needing human attention:
  • <file> — reason: <text>

Full suite: `npx jest tests/unit/` → {{ N }} suites, {{ N }} tests, {{ pass/fail }}

No commits made. Review `git status` and commit when ready.
```

## Phase 6 — Latent bugs prompt (auto when count > 0)

Identical to `slices.md` Phase 6 — auto-prompt via `AskUserQuestion` to persist
flagged bugs to `memory/<package>-latent-bugs.md` (all / P0+P1 only / skip), with
the same memory-file format and MEMORY.md pointer. Do not repeat it here; follow
`slices.md` Phase 6 verbatim.

## Phase 7 — Persist learnings

Append to `.claude/memory/test-patterns.md` (new node mocking patterns) and
`.claude/memory/latent-bugs.md` (all `latent_bugs`).

## Phase 8 — Hands off

```
Done. To commit:
  git add <PLATFORM_ROOT>/tests/unit
  git commit -m "test(<TICKET>): cover <CLASSIFICATION> batch"
  git push

Or revert:
  git checkout <PLATFORM_ROOT>/tests/unit
```

Never call `git add`, `git commit`, or `git push` yourself.

## Guardrails

- DO NOT modify source files.
- DO NOT commit.
- DO NOT touch files outside `<PLATFORM_ROOT>/tests/`.
- DO NOT run `npm test` on the whole repo — only `npx jest tests/unit/` in the target package.
- DO surface latent bugs to the user.
