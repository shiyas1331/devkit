---
description: Generate tests for a single source file. Classification is auto-detected.
argument-hint: <file-path>
model: opus
---

# /devkit:cover:file — cover a single source file

Equivalent to `/devkit:cover <file-path>` (bare file path ending in `.ts` or `.tsx`). Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt once: `"File path? (must end in .ts or .tsx)"`.

## Context loading

Read available context BEFORE doing anything:

1. `CLAUDE.md` in the repo root (project conventions)
2. `.claude/codebase/*.md` (if exists)
3. `.claude/memory/test-patterns.md` (accumulated patterns from prior runs)
4. `.claude/memory/latent-bugs.md` (bugs found in prior runs — for cross-reference)

## Phase 0 — Detect platform

For the file's containing package:

1. List `<plugin-root>/platforms/` to enumerate available platforms.
2. For each platform, read `<plugin-root>/platforms/<name>/detect.md` and apply the rules.
3. Pick the first matching platform. Set `PLATFORM` + `PLATFORM_ROOT`.

If no platform matches, error and STOP.

## Phase 1 — Classify

**If `PLATFORM==node`:** do NOT use the React Native table below. Read
`<plugin-root>/platforms/node/classifications.md` and classify with its table
(`manager` / `repository` / `mapper` / `service` / `util` / `worker`), then skip
to Phase 2. The table below is React-Native-only.

Determine `CLASSIFICATION` from the file contents using this table:

| Signal | Classification |
|---|---|
| imports createSlice from @reduxjs/toolkit | slice |
| exports createAsyncThunk(...) | thunk |
| filename matches use*.{ts,tsx} and exports the function | hook-pure / hook-redux / hook-bottomsheet |
| imports `createListenerMiddleware` from @reduxjs/toolkit | listener |
| filename ends in `Listener.ts(x)` and exports a middleware | listener |
| a static-method class with DB or external calls | service |
| filename ends in Container.tsx, mounts a screen | container |
| pure functions in utils/, no React/Redux deps | util |

Sub-classification for hooks:
- `hook-bottomsheet`: imports from `@providers/BottomSheetProvider`
- `hook-redux`: imports `useSelector` or `useDispatch`
- `hook-pure`: neither of the above

## Phase 2 — Load template + conventions

1. Read the template ONCE from `<plugin-root>/platforms/<PLATFORM>/templates/<classification>.template.md` → store as `TEMPLATE_CONTENT`.
2. Read the conventions ONCE from `<plugin-root>/platforms/<PLATFORM>/conventions.md` → store as `CONVENTIONS_CONTENT`.

## Phase 3 — Spawn agent

Spawn one **`test-engineer`** agent — INLINE the content directly into the prompt:

```
PLATFORM=<PLATFORM>
SOURCE_FILE=<absolute path>
CLASSIFICATION=<classification>
PACKAGE_ROOT=<PLATFORM_ROOT>
TEST_DIR=<TEST_DIR or empty>      # node: tests/unit (per-method, centralized). RN: omit (co-located __tests__/)
EXISTING_FIXTURES=<comma-separated list of make*.ts files in fixtures/, or empty>

TEMPLATE:
<paste TEMPLATE_CONTENT verbatim here>

CONVENTIONS:
<paste CONVENTIONS_CONTENT verbatim here>
```

The agent does NOT read these files itself — they're already in its prompt.

**Node note:** when `TEST_DIR` is set the agent emits **one test file per public
method** under `TEST_DIR` (see conventions §2) and reports them all in
`test_files`. RN continues to emit a single co-located file (`test_file`).

## Phase 4 — Report

Wait for the agent's JSON output. Read it. Print:

```
✅ <SOURCE_FILE>: {{ tests_added }} tests added across {{ test_files.length or 1 }} file(s), all passing.

Test files:
  • {{ each test_files (node: one per method) — or the single test_file (RN) }}

Latent bugs flagged ({{ count }}):
  • Line {{ N }} [{{ priority }}]: {{ description }}

Fixtures created: {{ list or "none" }}
Retries used: {{ N }}

Review the diff and commit when ready.
```

Prefer `test_files` (node, per-method) when present; otherwise use `test_file` (RN).

If status is `needs-human` or `skipped`, surface the reason prominently.

## Phase 5 — Latent bugs prompt (auto-triggered when count > 0)

If `latent_bugs.length > 0`, MUST auto-prompt using `AskUserQuestion`. Do NOT wait for the user to ask.

```
question: "{{ N }} latent bug(s) flagged. Add to memory for follow-up?"
header: "Memory"
multiSelect: false
options:
  - label: "Yes — add all with priorities"
    description: "Append every bug to memory/<package>-latent-bugs.md grouped by P0/P1/P2/P3. Updates MEMORY.md pointer."
  - label: "Yes — only P0 and P1 (high priority)"
    description: "Append only the high-priority bugs. Skip P2/P3 housekeeping items."
  - label: "Skip — don't add"
    description: "Bugs remain visible in this turn's report only. They will NOT be persisted."
```

**Action mapping:**

| Choice | Action |
|---|---|
| Yes — all | Append every bug to `memory/<package>-latent-bugs.md` with full priority tags. Update MEMORY.md pointer. |
| Yes — P0/P1 only | Same, filtered. Note that P2/P3 were skipped intentionally. |
| Skip | Print "Latent bugs not persisted." and proceed. |

**Memory file format** (consistent with `editors-latent-bugs-cat494-batch.md`):

```markdown
---
name: <package>-latent-bugs
description: Production-code quirks surfaced by /devkit:cover test-engineer agents. Tests pin current behaviour; fixes belong in a separate ticket.
metadata:
  type: project
---

## ⚡ Priority index

### 🔴 P0 — fix first (active misbehavior, every-user impact)
| # | Bug | Why P0 |
|---|---|---|
| 1 | `<file>:<line>` — <description> | <agent-supplied rationale> |

### 🟠 P1 — fix soon (real UX issues on specific paths)
...

### 🟡 P2 — moderate
...

### 🟢 P3 — minor
...

---

## Detailed entries

### 1. `<file>:<line>` [P0] — <title>
<description>
*Test pinning current behaviour: `<test-file>`*
```

**MEMORY.md pointer format** (one line, ~150 chars):

```markdown
- [Latent bugs in <package>](memory/<package>-latent-bugs.md) — N production-code bugs flagged by /devkit:cover agents (M P0, M P1, M P2, M P3). Top concerns: <1-2 most serious>.
```

If a memory file already exists, **append** (numbered after existing entries). Do NOT clobber.

## Phase 6 — Persist learnings

Append to:
- `.claude/memory/test-patterns.md` — any NEW mocking patterns the agent invented.
- `.claude/memory/latent-bugs.md` — all `latent_bugs` entries from the agent.

Format for `latent-bugs.md`:

```markdown
## <date> — <package>

- `<file>:<line>` — <description>
  Test: `<test-file>` (pins current behaviour)
  Status: open / fixed / wont-fix
```

## Phase 7 — Hands off

```
Done. To commit:
  git add <test path>          # RN: <package>/src/.../__tests__/   node: <PLATFORM_ROOT>/tests/unit/
  git commit -m "test(<TICKET>): cover <file-basename>"
  git push

Or revert if anything looks off:
  git checkout <test path>     # RN: .../__tests__/   node: tests/unit/<...>/<basename>.<layer>/
```

Never call `git add`, `git commit`, or `git push` yourself.

## Guardrails

- DO NOT modify source files. Tests describe; they don't fix.
- DO NOT commit. Engineer reviews.
- DO use existing fixtures before creating new ones (node defines factories locally per test file — see conventions §5).
- DO surface latent bugs to the user — they're often more valuable than the coverage itself.
