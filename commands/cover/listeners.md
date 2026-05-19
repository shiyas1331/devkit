---
description: Generate unit tests for every untested RTK listener (createListenerMiddleware) in a package. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:listeners — listener batch

Equivalent to `/devkit:cover <path> --batch listeners`. Skips the picker.

## Listener-specific gotchas (covered by the template)

- Use a **recorder middleware** (NOT `jest.spyOn(store, 'dispatch')` — the spy can't see listener-internal dispatches)
- Import **REAL** trigger thunks (don't stub — listener uses `actionCreator.match(action)`)

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"Package path? (e.g. packages/establishment)"`.

## Context loading

1. `CLAUDE.md` in the repo root
2. `.claude/codebase/*.md`
3. `.claude/memory/test-patterns.md`
4. `.claude/memory/latent-bugs.md`

## Phase 0 — Detect platform

1. List `<plugin-root>/platforms/`.
2. Read each `detect.md`. Set `PLATFORM`, `PLATFORM_ROOT`. Error + STOP if no match.

## Phase 1 — Discover (silent, filtered to listeners)

Spawn `codebase-locator` to enumerate untested `.ts/.tsx` files under `<PLATFORM_ROOT>` that:
- Import `createListenerMiddleware` from `@reduxjs/toolkit`, OR
- End in `Listener.ts(x)` and export a middleware

Skip files with an existing `__tests__/<basename>.test.ts(x)`.

## Phase 2 — Load template + conventions ONCE

1. Read `<plugin-root>/platforms/<PLATFORM>/templates/listener.template.md` → `TEMPLATE_CONTENT`
2. Read `<plugin-root>/platforms/<PLATFORM>/conventions.md` → `CONVENTIONS_CONTENT`

## Phase 3 — Spawn agents (parallel, pool of 5)

For each untested listener file:

```
PLATFORM=<PLATFORM>
SOURCE_FILE=<absolute path>
CLASSIFICATION=listener
PACKAGE_ROOT=<PLATFORM_ROOT>
EXISTING_FIXTURES=<comma-separated list>

TEMPLATE:
<paste TEMPLATE_CONTENT verbatim>

CONVENTIONS:
<paste CONVENTIONS_CONTENT verbatim>
```

The agent does NOT read these files itself.

## Phase 4 — Aggregate + verify

1. Collect JSON outputs.
2. Run `npm test` once on the package.

## Phase 5 — Report

```
📦 Batch listeners — <package>

✅ Passed:        {{ N }} files / {{ N }} tests
⚠️  Needs human:  {{ N }} files
⏭️  Skipped:      {{ N }} files

Latent bugs flagged across batch ({{ count }}):
  P0: {{ N }}    P1: {{ N }}    P2: {{ N }}    P3: {{ N }}

  • <file:line> [P0]: <description>
  • ...

Full suite: `npm test` → {{ N }} suites, {{ N }} tests, {{ pass/fail }}

No commits made. Review `git status` and commit when ready.
```

## Phase 6 — Latent bugs prompt (auto-triggered when count > 0)

If `latent_bugs.length > 0`, MUST auto-prompt via `AskUserQuestion`:

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
| Yes — all | Append every bug to `memory/<package>-latent-bugs.md`. Update MEMORY.md pointer. |
| Yes — P0/P1 only | Same, filtered. |
| Skip | Print "Latent bugs not persisted." and proceed. |

**Memory file format:**

```markdown
---
name: <package>-latent-bugs
description: Production-code quirks surfaced by /devkit:cover test-engineer agents.
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

**MEMORY.md pointer:**
```markdown
- [Latent bugs in <package>](memory/<package>-latent-bugs.md) — N bugs flagged by /devkit:cover agents (M P0, M P1, M P2, M P3).
```

If a memory file already exists, **append**. Do NOT clobber.

## Phase 7 — Persist learnings

Append to:
- `.claude/memory/test-patterns.md` — NEW mocking patterns.
- `.claude/memory/latent-bugs.md` — all `latent_bugs` entries.

## Phase 8 — Hands off

```
Done. To commit:
  git add <package-path/src>
  git commit -m "test(<TICKET>): cover listeners batch"
  git push
```

Never call `git add`, `git commit`, or `git push` yourself.

## Guardrails

- DO NOT modify source files
- DO NOT commit
- DO NOT touch files outside the target package
- DO use existing fixtures before creating new ones
- DO surface latent bugs to the user
