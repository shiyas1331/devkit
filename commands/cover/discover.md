---
description: Discover untested code in a package and produce a coverage plan with suggested batches. Default mode for bare directory paths.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:discover — scan untested files + produce a plan

Equivalent to `/devkit:cover <path>` (bare directory path with no flag). Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt once: `"Package path? (e.g. packages/establishment)"`.

## Context loading

Read available context BEFORE doing anything:

1. `CLAUDE.md` in the repo root (project conventions)
2. `.claude/codebase/*.md` (if exists)
3. `.claude/memory/test-patterns.md` (accumulated patterns from prior runs)
4. `.claude/memory/latent-bugs.md` (bugs found in prior runs — for cross-reference)

## Phase 0 — Detect platform

For the target path:

1. List `<plugin-root>/platforms/` to enumerate available platforms.
2. For each platform, read `<plugin-root>/platforms/<name>/detect.md` and apply the rules.
3. Pick the first matching platform. Set:

```
PLATFORM=<name>
PLATFORM_ROOT=<path to package.json dir>
WORKSPACE_ROOT=<nearest workspace ancestor or PLATFORM_ROOT>
HAS_BABEL_ALIASES=true|false
HAS_JEST_CONFIG=true|false
HAS_MOCKS_DIR=true|false
```

If no platform matches, print:

```
Error: could not detect platform for <path>.
Supported platforms: <list>.
```

and STOP.

## Phase 1 — Discover

**If `PLATFORM==node`:** read `<plugin-root>/platforms/node/classifications.md`
and spawn `codebase-locator` to scan `<PLATFORM_ROOT>/src/**` and
`<PLATFORM_ROOT>/workers/**` using **that** table (manager/repository/mapper/
service/util/worker). The "already tested" check is per-method: a source file is
untested for any public method lacking a
`tests/unit/<mirrored-path>/<basename>.<layer>/<method>.test.ts`. Return a JSON
inventory grouped by those node classifications (mirroring the shape below), then
skip to Phase 2. Everything below is the React Native scan.

Spawn **`codebase-locator`** agent with this prompt:

```
You are scanning <PLATFORM_ROOT> for untested source files.

For each .ts/.tsx file (excluding __tests__/, __mocks__/, *.d.ts, *.types.ts):
  - Determine classification per this table:
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
    | screen, navigator, type-only | other |

  Sub-classification for hooks:
    - hook-bottomsheet: imports from @providers/BottomSheetProvider
    - hook-redux: imports useSelector or useDispatch
    - hook-pure: neither of the above

  - Check if a matching __tests__/<basename>.test.ts(x) exists.
  - Estimate branch count (count `if`, `?:`, `&&`/`||` short-circuits).
  - Estimate complexity: low (<20 lines), med (20-100), high (>100).

Return a JSON inventory grouped by classification:
{
  "slices": [
    { "path": "...", "tested": false, "branches": 4, "complexity": "med" },
    ...
  ],
  "thunks": [...],
  "listeners": [...],
  "hooks": { "pure": [...], "redux": [...], "bottomsheet": [...] },
  "services": [...],
  "containers": [...]
}
```

## Phase 2 — Build plan

Build a markdown plan, save to `specs/plans/<date>-cover-<package-name>.md`.

## Phase 3 — Present

**If `PLATFORM==node`,** present node classifications + batches instead:

```
📊 Discovered in <PLATFORM_ROOT>:

  • {{ managers.untested }} managers untested (of {{ managers.total }})
  • {{ repositories.untested }} repositories untested (of {{ repositories.total }})
  • {{ mappers.untested }} mappers untested (of {{ mappers.total }})
  • {{ services.untested }} services untested (of {{ services.total }})
  • {{ utils.untested }} utils untested (of {{ utils.total }})
  • {{ workers.untested }} worker units untested (of {{ workers.total }})

Suggested batches (priority order):
  [1] All mappers         → {{ N }} files, confidence: high   (pure, no mocks)
  [2] All repositories    → {{ N }} files, confidence: high   (spy on base methods)
  [3] All utils           → {{ N }} files, confidence: high   (pure)
  [4] All managers        → {{ N }} files, confidence: med    (TypeDI + mocked repos)
  [5] All services        → {{ N }} files, confidence: med    (mock the SDK client)
  [6] All worker units    → {{ N }} files, confidence: med    (processors/handlers)

Plan saved to specs/plans/<date>-cover-<package>.md

Pick a batch number, name a specific file, or run --batch <managers|repositories|mappers|services|util|workers>.
```

STOP.

The React Native presentation:

```
📊 Discovered in <PLATFORM_ROOT>:

  • {{ slices.untested }} slices untested (of {{ slices.total }})
  • {{ thunks.untested }} thunks untested (of {{ thunks.total }})
  • {{ hooks.untested }} hooks untested (of {{ hooks.total }})
  • {{ services.untested }} services untested (of {{ services.total }})
  • {{ containers.untested }} containers untested (of {{ containers.total }})

Suggested batches (priority order):
  [1] All slices                 → {{ N }} files, ~{{ hrs }} hrs, confidence: high
  [2] All fetch thunks           → {{ N }} files, ~{{ hrs }} hrs, confidence: high
  [3] All post/update thunks     → {{ N }} files, ~{{ hrs }} hrs, confidence: med
  [4] All hooks                  → {{ N }} files, ~{{ hrs }} hrs, confidence: med
  [5] Service tests              → {{ N }} files, ~{{ hrs }} hrs, confidence: high
  [6] Container tests            → {{ N }} files, ~{{ hrs }} hrs, confidence: low

Plan saved to specs/plans/<date>-cover-<package>.md

Pick a batch number, name a specific file, or run --batch <name>.
```

STOP.

## Guardrails

- Read-only. Never modifies source files.
- DO NOT spawn `test-engineer` — this mode only discovers + plans.
