---
description: Shared body for android batch sub-commands (viewmodels/repositories/util/models). Not invoked directly.
argument-hint: <module-path> (with CLASSIFICATION set by the caller)
model: opus
---

# /devkit:cover android batch (shared body)

This is the generic batch runner for the **android** platform. The thin
per-classification commands (`viewmodels.md`, `repositories.md`, `util.md`,
`models.md`) delegate here after setting `CLASSIFICATION`. It mirrors the node
batch flow but emits **one test file per source file** under the module's
`src/test/java/` (mirrored package), verified with a module-scoped,
class-filtered gradle run.

## Input

```
$ARGUMENTS            # the module/dir path
CLASSIFICATION        # set by the delegating command: viewmodel|repository|util|model
```

If `$ARGUMENTS` is empty, prompt: `"Module path? (e.g. order or payments/src/main/java/com/practo/payments/paytm)"`.

## Context loading

Read BEFORE doing anything:
1. `CLAUDE.md` in the repo root
2. `.claude/codebase/*.md` (if exists)
3. `.claude/memory/test-patterns.md`
4. `.claude/memory/latent-bugs.md`

## Phase 0 — Detect platform

1. List `<plugin-root>/platforms/` and apply each `detect.md`.
2. Require `PLATFORM==android`. If detection yields a different platform, STOP
   and tell the user this batch is android-only.
3. Set `PLATFORM_ROOT`, `GRADLE_MODULE`, `MODULE_DIR`,
   `TEST_DIR=<MODULE_DIR>/src/test/java`, `UNIT_TEST_TASK`,
   `HAS_MOCKMAKER_INLINE`, `HAS_TEST_MODULE_DEP`.

## Phase 0.5 — Preflight

Check the module's build file has the core test deps (junit, mockito-kotlin,
truth, coroutines-test; arch-core for viewmodel batches). If the block is
missing entirely, STOP and tell the user to run
`/devkit:cover <module> --setup` first. Do NOT edit build files here.

## Phase 1 — Discover (silent, filtered to CLASSIFICATION)

Read `<plugin-root>/platforms/android/classifications.md`. Spawn
`codebase-locator` to enumerate every `.kt`/`.java` file under
`<MODULE_DIR>/src/main/java/**` (and `src/main/kotlin/**`) that:
- matches `CLASSIFICATION` per the android table, AND
- has NO matching `<TEST_DIR>/<package path>/<Name>Test.kt` (also check the
  `<Name>KtTest.kt` variant and `.java` twin).

Skip abstract base classes, interfaces, and everything the table marks `other`.

Result: a list of source files to cover.

## Phase 2 — Load template + conventions ONCE

1. Read `<plugin-root>/platforms/android/templates/<CLASSIFICATION>.template.md` → `TEMPLATE_CONTENT`
2. Read `<plugin-root>/platforms/android/conventions.md` → `CONVENTIONS_CONTENT`

## Phase 3 — Spawn agents (parallel, pool of 3)

Pool is 3 (not 5): each agent runs its own gradle invocation and concurrent
gradle builds on one project serialize on file locks — more than ~3 just queues.

For each source file, spawn one `test-engineer` agent:

```
PLATFORM=android
SOURCE_FILE=<absolute path>
CLASSIFICATION=<CLASSIFICATION>
PACKAGE_ROOT=<PLATFORM_ROOT>
TEST_DIR=<MODULE_DIR>/src/test/java
TEST_GRANULARITY=per-file        # android: ONE test file per source file at TEST_DIR/<package>/<Name>Test.kt — NOT per-method
GRADLE_MODULE=<GRADLE_MODULE>
UNIT_TEST_TASK=<UNIT_TEST_TASK>
EXISTING_FIXTURES=<comma-separated *StubFactory.kt / *TestHelper.kt in the module's test dir, or empty>

TEMPLATE:
<paste TEMPLATE_CONTENT verbatim>

CONVENTIONS:
<paste CONVENTIONS_CONTENT verbatim>
```

The agent emits one `<Name>Test.kt`, runs the class-filtered gradle command
from conventions §7, retries up to 2×, and returns `test_file` in its JSON.

## Phase 4 — Aggregate + verify

1. Collect JSON outputs from all agents (use `test_file`, sum `tests_added`).
2. Run ONE combined verification at `<PLATFORM_ROOT>`:
   ```bash
   ./gradlew <GRADLE_MODULE>:<UNIT_TEST_TASK> --tests "com.pkg.ATest" --tests "com.pkg.BTest" …
   ```
   (`GRADLE_MODULE` empty → no `:module:` prefix; NEVER drop the `--tests`
   filters on the root project — it has pre-existing failing tests.)

## Phase 5 — Report

```
📦 Batch <CLASSIFICATION> — <module>

✅ Passed:        {{ N }} source files / {{ N }} test files / {{ T }} tests
⚠️  Needs human:  {{ N }} files (see below)
⏭️  Skipped:      {{ N }} files (see below)

Latent bugs flagged across batch ({{ count }}):
  P0: {{ N }}    P1: {{ N }}    P2: {{ N }}    P3: {{ N }}
  • <file:line> [P0]: <description>
  • ...

Files needing human attention:
  • <file> — reason: <text>

Combined run: `./gradlew <GRADLE_MODULE>:<UNIT_TEST_TASK> --tests …` → {{ N }} tests, {{ pass/fail }}

No commits made. Review `git status` and commit when ready.
```

## Phase 6 — Latent bugs prompt (auto when count > 0)

Identical to `slices.md` Phase 6 — auto-prompt via `AskUserQuestion` to persist
flagged bugs to `memory/<module>-latent-bugs.md` (all / P0+P1 only / skip), with
the same memory-file format and MEMORY.md pointer. Do not repeat it here; follow
`slices.md` Phase 6 verbatim.

## Phase 7 — Persist learnings

Append to `.claude/memory/test-patterns.md` (new android mocking patterns) and
`.claude/memory/latent-bugs.md` (all `latent_bugs`).

## Phase 8 — Hands off

```
Done. To commit:
  git add <MODULE_DIR>/src/test
  git commit -m "test(<TICKET>): cover <module> <CLASSIFICATION> batch"
  git push

Or revert:
  git checkout <MODULE_DIR>/src/test
```

Never call `git add`, `git commit`, or `git push` yourself.

## Guardrails

- DO NOT modify source files.
- DO NOT modify build files (that's `--setup`); the ONE exception any agent may
  make is creating the module's mock-maker-inline resource (conventions §3).
- DO NOT commit.
- DO NOT touch files outside `<MODULE_DIR>/src/test/`.
- DO NOT run an unscoped `./gradlew test` — only the module's unit-test task,
  `--tests`-filtered on the root project.
- DO surface latent bugs to the user.
