---
description: Generate unit tests for every untested slice in a package. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:slices — slice batch

Equivalent to `/devkit:cover <path> --batch slices`. Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"Package path? (e.g. packages/establishment)"`.

## Context loading

Read available context BEFORE doing anything:

1. `CLAUDE.md` in the repo root (project conventions)
2. `.claude/codebase/*.md` (if exists)
3. `.claude/memory/test-patterns.md`
4. `.claude/memory/latent-bugs.md`

## Phase 0 — Detect platform

1. List `<plugin-root>/platforms/` to enumerate available platforms.
2. For each, read `detect.md` and apply the rules.
3. Set `PLATFORM`, `PLATFORM_ROOT`. If none match, error and STOP.

## Phase 1 — Discover (silent, filtered to slices)

Spawn `codebase-locator` agent to enumerate all `.ts/.tsx` files under `<PLATFORM_ROOT>` that:
- Import `createSlice` from `@reduxjs/toolkit`
- Do NOT already have a matching `__tests__/<basename>.test.ts(x)` file

Result: a list of untested slice files.

## Phase 2 — Load template + conventions ONCE

1. Read `<plugin-root>/platforms/<PLATFORM>/templates/slice.template.md` → `TEMPLATE_CONTENT`
2. Read `<plugin-root>/platforms/<PLATFORM>/conventions.md` → `CONVENTIONS_CONTENT`

## Phase 3 — Spawn agents (parallel, pool of 5)

For each untested slice file, spawn one `test-engineer` agent with the prompt:

```
PLATFORM=<PLATFORM>
SOURCE_FILE=<absolute path>
CLASSIFICATION=slice
PACKAGE_ROOT=<PLATFORM_ROOT>
EXISTING_FIXTURES=<comma-separated list of make*.ts in fixtures/>

TEMPLATE:
<paste TEMPLATE_CONTENT verbatim>

CONVENTIONS:
<paste CONVENTIONS_CONTENT verbatim>
```

The agent does NOT read these files itself — they're already in its prompt.

## Phase 4 — Aggregate + verify

1. Collect JSON outputs from all agents.
2. Run `npm test` once on the package to verify nothing broke.

## Phase 5 — Report

```
📦 Batch slices — <package>

✅ Passed:        {{ N }} files / {{ N }} tests
⚠️  Needs human:  {{ N }} files (see below)
⏭️  Skipped:      {{ N }} files (see below)

Latent bugs flagged across batch ({{ count }}):
  P0: {{ N }}    P1: {{ N }}    P2: {{ N }}    P3: {{ N }}

  • <file:line> [P0]: <description>
  • <file:line> [P1]: <description>
  • ...

Files needing human attention:
  • <file> — reason: <text>

Files skipped:
  • <file> — reason: <text>

Full suite: `npm test` → {{ N }} suites, {{ N }} tests, {{ pass/fail }}

No commits made. Review `git status` and commit when ready.
```

## Phase 6 — Latent bugs prompt (auto-triggered when count > 0)

If `latent_bugs.length > 0`, MUST auto-prompt via `AskUserQuestion`. Do NOT wait.

```
question: "{{ N }} latent bug(s) flagged. Add to memory for follow-up?"
header: "Memory"
multiSelect: false
options:
  - label: "Yes — add all with priorities"
    description: "Append every bug to memory/<package>-latent-bugs.md grouped by P0/P1/P2/P3."
  - label: "Yes — only P0 and P1 (high priority)"
    description: "Append only the high-priority bugs. Skip P2/P3."
  - label: "Skip — don't add"
    description: "Bugs remain in this turn's report only."
```

**Action mapping:**

| Choice | Action |
|---|---|
| Yes — all | Append every bug to `memory/<package>-latent-bugs.md` with full priority tags. Update MEMORY.md pointer. |
| Yes — P0/P1 only | Same, filtered. Note that P2/P3 were skipped. |
| Skip | Print "Latent bugs not persisted." and proceed. |

**Memory file format:**

```markdown
---
name: <package>-latent-bugs
description: Production-code quirks surfaced by /devkit:cover test-engineer agents. Tests pin current behaviour; fixes belong in a separate ticket.
metadata:
  type: project
---

## ⚡ Priority index

### 🔴 P0 — fix first
| # | Bug | Why P0 |
|---|---|---|
| 1 | `<file>:<line>` — <description> | <rationale> |

### 🟠 P1 — fix soon
### 🟡 P2 — moderate
### 🟢 P3 — minor

---

## Detailed entries
### 1. `<file>:<line>` [P0] — <title>
<description>
*Test pinning current behaviour: `<test-file>`*
```

**MEMORY.md pointer** (one line, ~150 chars):
```markdown
- [Latent bugs in <package>](memory/<package>-latent-bugs.md) — N bugs flagged by /devkit:cover agents (M P0, M P1, M P2, M P3).
```

If a memory file already exists, **append** (numbered after existing). Do NOT clobber.

## Phase 7 — Persist learnings

Append to:
- `.claude/memory/test-patterns.md` — any NEW mocking patterns the agent invented.
- `.claude/memory/latent-bugs.md` — all `latent_bugs` entries.

## Phase 8 — Hands off

```
Done. To commit:
  git add <package-path/src>
  git commit -m "test(<TICKET>): cover slices batch"
  git push

Or revert if anything looks off:
  git checkout <package-path/src/.../__tests__/>
```

Never call `git add`, `git commit`, or `git push` yourself.

## Guardrails

- DO NOT modify source files
- DO NOT commit
- DO NOT touch files outside the target package
- DO NOT run `npm test` on the whole repo — only the target package
- DO use existing fixtures before creating new ones
- DO surface latent bugs to the user
