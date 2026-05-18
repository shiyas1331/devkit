---
description: Scaffold and generate unit tests for a package or file. Platform-aware (react-native today).
argument-hint: <path> [--setup | --batch <name> | --report] OR <single-file>
model: opus
---

# Cover with unit tests

You are tasked with automating the unit-test workflow proven in the
provider-app `packages/editors` foundation (PR #470, #471). Your goal is
to scaffold + generate tests with high consistency and minimal engineer
effort.

**Response format — always (except the final report):**
- What was done (max 2-3 bullets)
- Exactly what the developer needs to do right now
- What happens next

Never narrate reasoning. Be terse. Directional.

> **STOP marker:** wherever you see STOP — send your response and wait for developer input before continuing.

## Mode picker (front door for empty invocations)

**Two front doors based on how the user invoked the command:**

### Front door A — empty input → interactive picker

**Trigger:** `$ARGUMENTS` is empty.

Use the `AskUserQuestion` tool. Do NOT print a menu in text. Do NOT read the help file. Native UI is faster.

**Question 1** — mode selection:

```
question: "What do you want to do?"
header: "Mode"
multiSelect: false
options:
  - label: "Discover untested code"
    description: "Scan a package and list untested slices/thunks/hooks/services. Outputs a plan with suggested batches. Example: scan packages/establishment → shows 18 slices, 24 thunks, 12 hooks untested."
  - label: "Write tests"
    description: "Generate test files for one source file or a batch (slices, thunks, hooks). Runs jest after each. Example: write tests for every slice in packages/establishment in one batch."
  - label: "Setup foundation (one-time)"
    description: "Scaffold jest.config.js, setup.ts, test-utils, and native module mocks. Run this once on a fresh package before generating tests. Example: setup packages/establishment from zero test infra."
  - label: "Show coverage report"
    description: "Print coverage delta against baseline plus latent bugs flagged in earlier runs. Example: see that establishment went from 12% to 67% coverage."
```

After answer, ask for the path (regular text prompt, NOT a tool):

```
Path? (e.g. `packages/establishment`, or a specific file path for "Write tests"). Type `?` for the verbose reference.
```

If the user picked **"Write tests"** AND the path they provide is a directory (not a file), ask **Question 2** to pick the scope:

```
question: "What scope?"
header: "Scope"
multiSelect: false
options:
  - label: "All slices"
    description: "Every file importing createSlice. High agent confidence — mechanical pattern. Example: 18 educationSlice/registrationSlice/feeSlice files in one batch."
  - label: "All thunks"
    description: "Every createAsyncThunk export — fetch/post/update/delete variants. Example: PostEducationDetail, FetchAbout, UpdateContact, etc., all covered together."
  - label: "All hooks"
    description: "Pure hooks (useDebounce), Redux hooks (useProfileType), bottom-sheet hooks (useYearBottomSheet). Mixed agent confidence. Example: 12 hook files in packages/establishment."
  - label: "Services and containers"
    description: "SQLite services (CustomEntityService) and screen containers (EducationListingContainer). Containers are lowest-confidence — agent may mark some 'needs-human'."
```

Map the chosen mode + scope to the corresponding command and re-invoke:

| Mode chosen | Scope chosen (if asked) | Command run |
|---|---|---|
| Discover | — | `/devkit:cover <path>` |
| Write tests + file given | — | `/devkit:cover <file>` |
| Write tests + dir + slices | — | `/devkit:cover <path> --batch slices` |
| Write tests + dir + thunks | — | `/devkit:cover <path> --batch thunks` |
| Write tests + dir + hooks | — | `/devkit:cover <path> --batch hooks` |
| Write tests + dir + svc/cont | — | `/devkit:cover <path> --batch services-containers` |
| Setup foundation | — | `/devkit:cover <path> --setup` |
| Show coverage report | — | `/devkit:cover <path> --report` |

### Front door B — explicit help token → verbose reference

**Trigger:** `$ARGUMENTS` contains `--help`, `-h`, or `?` as a standalone token.

This is the user explicitly asking for the full reference. Don't open the picker.

1. Locate the help reference at `<plugin-root>/references/help/cover.md`.
2. Read it.
3. Print the **"Verbose flag reference"** section verbatim.
4. STOP. The user reads, then re-invokes with concrete args.

### Skip both front doors

When any real path, file, or recognized flag is provided in `$ARGUMENTS`, both front doors are skipped — the command proceeds directly to platform detection.

## Input

```
$ARGUMENTS
```

Parse the input as one of:

1. **`<package-path>` only** → discover + plan mode.
2. **`<package-path> --setup`** → setup mode (one-time scaffolding).
3. **`<package-path> --batch <name>`** → batch coverage mode.
4. **`<package-path> --report`** → coverage delta + latent-bug summary.
5. **`<file-path>`** (ends in `.ts` or `.tsx` and exists) → single-file mode.

Resolve relative paths against the current working directory.

## Context loading

Read available context BEFORE doing anything:

1. `CLAUDE.md` in the repo root (project conventions)
2. `.claude/codebase/*.md` (if exists)
3. `.claude/memory/test-patterns.md` (accumulated patterns from prior runs)
4. `.claude/memory/latent-bugs.md` (bugs found in prior runs — for cross-reference)

## Phase 0 — Detect platform

For the target path (the directory containing the target file, or the path itself for directory modes):

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

## Phase 1 — Branch by mode

### Mode A — `--setup`

Goal: scaffold the test foundation for a fresh package. Idempotent (re-running won't clobber existing files).

Steps:

1. **Validate target**: must be a directory with `package.json`. If not, error and STOP.

2. **Detect existing foundation**:
   - `HAS_JEST_CONFIG=true` if `<PLATFORM_ROOT>/jest.config.{js,ts}` exists with `preset: 'react-native'`.
   - `HAS_MOCKS_DIR=true` if `<PLATFORM_ROOT>/__mocks__/` exists.
   - Setup files present at `<PLATFORM_ROOT>/src/__tests__/setup.ts`, `utils/createTestStore.ts`, etc.

3. **Build moduleNameMapper from babel.config.js**:
   - Read `<PLATFORM_ROOT>/babel.config.js`.
   - Extract the `alias` block under `babel-plugin-module-resolver`.
   - For each alias `@foo/*: 'path/to/foo/*'`, emit a Jest mapper line:
     ```
     '^@foo/(.*)$': '<rootDir>/path/to/foo/$1',
     ```
   - Adjust `<rootDir>` for paths that go above the package root.

4. **Generate files** (skip any that already exist; warn user instead of clobbering):

   | File | From template | Substitutions |
   |---|---|---|
   | `jest.config.js` | `scaffolds/jest.config.template.js` | `{{ moduleNameMapper }}` |
   | `src/__tests__/setup.ts` | `scaffolds/setup.template.ts` | `{{ apiFetchAlias }}`, `{{ storeIndexAlias }}`, `{{ providerUtilsAlias }}`, `{{ nativeNavigatorName }}` |
   | `src/__tests__/utils/createTestStore.ts` | `scaffolds/createTestStore.template.ts` | (none) |
   | `src/__tests__/utils/renderWithProviders.tsx` | `scaffolds/renderWithProviders.template.tsx` | `{{ rootReducerImport }}`, `{{ rootStateImport }}` |
   | `src/__tests__/utils/navigationMock.ts` | `scaffolds/navigationMock.template.ts` | (none) |
   | `src/__tests__/utils/index.ts` | barrel export | derived |
   | `src/__tests__/fixtures/.gitkeep` | empty | (none) |

   For aliases, infer from project conventions or ask the user once:
   - `{{ apiFetchAlias }}` — grep for `from.*fetch` in `src/api/`; default `'@api/fetch'`.
   - `{{ storeIndexAlias }}` — grep for the package's store index; default `'@store/index'`.
   - `{{ providerUtilsAlias }}` — default `'@provider-utils/ErrorUtil'`; ask if not found.
   - `{{ nativeNavigatorName }}` — grep `NativeModules.\w+`; default `'RNNativeNavigator'`.

5. **Copy native module mocks** to `<PLATFORM_ROOT>/__mocks__/`:
   - `reanimated.mock.js` → `react-native-reanimated.js`
   - `safeAreaContext.mock.tsx` → `react-native-safe-area-context.tsx`
   - `selfServe.mock.tsx` → `@practo/self-serve.tsx`
   - `fastImage.mock.tsx` → `react-native-fast-image.tsx`

6. **Modify `package.json`**:
   - Add devDeps if missing: `@testing-library/react-native`, `@testing-library/jest-native`.
   - Add scripts if missing: `test:watch`, `test:coverage`.

7. **Modify `tsconfig.json`**:
   - Add `@test-utils/*` and `@fixtures/*` to `compilerOptions.paths`.

8. **Modify `babel.config.js`**:
   - Add the same two aliases to the `babel-plugin-module-resolver` alias block.

9. **Run smoke test**:
   ```bash
   cd <PLATFORM_ROOT> && npm test -- --passWithNoTests 2>&1
   ```
   Must exit 0. If it fails, report the error and STOP (don't write more files — let the user fix the env).

10. **Report**:

```
✅ Setup complete for <PLATFORM_ROOT>

Files generated:
  • jest.config.js
  • src/__tests__/setup.ts
  • src/__tests__/utils/{createTestStore,renderWithProviders,navigationMock,index}.ts
  • __mocks__/{react-native-reanimated,react-native-safe-area-context,@practo/self-serve,react-native-fast-image}.{js,tsx}

Files modified:
  • package.json (devDeps + scripts)
  • tsconfig.json (test aliases)
  • babel.config.js (test aliases)

Smoke test passed: `npm test --passWithNoTests` → exit 0

Next: run `/devkit:cover <PLATFORM_ROOT>` to discover untested code.
```

### Mode B — Discover (default for directory paths)

Goal: scan the package, list untested files, suggest batches.

1. Spawn **`codebase-locator`** agent with this prompt:

```
You are scanning <PLATFORM_ROOT> for untested source files.

For each .ts/.tsx file (excluding __tests__/, __mocks__/, *.d.ts, *.types.ts):
  - Determine classification per this table:
    | Signal | Classification |
    |---|---|
    | imports createSlice from @reduxjs/toolkit | slice |
    | exports createAsyncThunk(...) | thunk |
    | filename matches use*.{ts,tsx} and exports the function | hook-pure / hook-redux / hook-bottomsheet |
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
  "hooks": { "pure": [...], "redux": [...], "bottomsheet": [...] },
  "services": [...],
  "containers": [...]
}
```

2. Build a markdown plan, save to `specs/plans/<date>-cover-<package-name>.md`.

3. Present:

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

### Mode C — Single file

Goal: cover one file.

1. Detect platform from the file's containing package.
2. Determine `CLASSIFICATION` from file contents (re-use the inventory rules above).
3. Read the template ONCE from `<plugin-root>/platforms/<PLATFORM>/templates/<classification>.template.md` → store as `TEMPLATE_CONTENT`.
4. Read the conventions ONCE from `<plugin-root>/platforms/<PLATFORM>/conventions.md` → store as `CONVENTIONS_CONTENT`.
5. Spawn one **`test-engineer`** agent — INLINE the content directly into the prompt:

```
PLATFORM=<PLATFORM>
SOURCE_FILE=<absolute path>
CLASSIFICATION=<classification>
PACKAGE_ROOT=<PLATFORM_ROOT>
EXISTING_FIXTURES=<comma-separated list of make*.ts files in fixtures/>

TEMPLATE:
<paste TEMPLATE_CONTENT verbatim here>

CONVENTIONS:
<paste CONVENTIONS_CONTENT verbatim here>
```

The agent does NOT read these files itself — they're already in its prompt. This makes the agent fully self-contained (works regardless of where devkit is installed) and avoids redundant file reads when batching.

6. Wait for its JSON output. Read it.

6. Report:

```
✅ <SOURCE_FILE>: {{ tests_added }} tests added, all passing.

Latent bugs flagged ({{ count }}):
  • Line {{ N }}: {{ description }}

Fixtures created: {{ list or "none" }}
Retries used: {{ N }}

Review the diff and commit when ready.
```

If status is `needs-human` or `skipped`, surface the reason prominently.

### Mode D — Batch

Goal: cover all files in a named batch (e.g. all slices).

1. Run discover (mode B) silently. Filter inventory to the named batch.
2. **Read templates + conventions ONCE** at the start of the batch:
   - For each classification present in the batch (slice / thunk / hook-* / service / container), read its template into a cache keyed by classification.
   - Read `<plugin-root>/platforms/<PLATFORM>/conventions.md` into `CONVENTIONS_CONTENT`.
3. For each file in the batch:
   - Look up the cached template for its classification.
   - Spawn `test-engineer` agent in parallel (pool of 5) with the template + conventions inlined into the prompt (NOT as paths — see Mode C above for the prompt shape).
4. Aggregate JSON outputs from all agents.
5. Run `npm test` once on the whole package to verify nothing broke.
5. Report:

```
📦 Batch <name> — <package>

✅ Passed:        {{ N }} files / {{ N }} tests
⚠️  Needs human:  {{ N }} files (see below)
⏭️  Skipped:      {{ N }} files (see below)

Latent bugs flagged across batch ({{ count }}):
  • <file:line> — <description>
  • ...

Files needing human attention:
  • <file> — reason: <text>

Files skipped:
  • <file> — reason: <text>

Full suite: `npm test` → {{ N }} suites, {{ N }} tests, {{ pass/fail }}

No commits made. Review `git status` and commit when ready.
```

### Mode E — Report

Goal: post-run summary.

1. Run `npm test -- --coverage` (only if a `.coverage-baseline.json` exists or the user explicitly opts in).
2. Compare against baseline.
3. Read `.claude/memory/latent-bugs.md` for accumulated findings.
4. Print:

```
📊 Coverage delta — <package>

Baseline: {{ pct }}%   →   Current: {{ pct }}%   (Δ +{{ pct }}pp)

Tests in this package: {{ N }} suites, {{ N }} tests

Latent bugs flagged so far ({{ count }}):
  • <file:line> — <description>

Next suggested work:
  • {{ N }} files remain untested in <classification>
```

## Phase 2 — Persist learnings

After every coverage run (Modes C, D), append to:

- `.claude/memory/test-patterns.md` — any NEW mocking patterns the agent invented (look for jest.mock calls in the new tests that don't match the conventions doc).
- `.claude/memory/latent-bugs.md` — all `latent_bugs` entries from agent outputs.

Format for `latent-bugs.md`:

```markdown
## <date> — <package>

- `<file>:<line>` — <description>
  Test: `<test-file>` (pins current behaviour)
  Status: open / fixed / wont-fix
```

## Phase 3 — Hands off

Print to the user:

```
Done. To commit:
  git add <packages/X/src>
  git commit -m "test(<TICKET>): cover <batch-or-file>"
  git push

Or revert if anything looks off:
  git checkout <packages/X/src/.../__tests__/>
```

Never call `git add`, `git commit`, or `git push` yourself.

## Guardrails

- DO NOT modify source files. Tests describe; they don't fix.
- DO NOT commit. Engineer reviews.
- DO NOT touch files outside the target package.
- DO NOT run `npm test` on the whole repo — only the target package.
- DO NOT skip the smoke test in `--setup` mode. If `npm test --passWithNoTests` fails, stop and report.
- DO use existing fixtures before creating new ones (grep `<PACKAGE_ROOT>/src/__tests__/fixtures/`).
- DO surface latent bugs to the user — they're often more valuable than the test coverage itself.

## Future platform support

When adding a new platform (e.g. `android`):
1. Drop `platforms/android/` with `detect.md`, `conventions.md`, `templates/`, `mocks/`, `scaffolds/`.
2. No changes needed to this command file — detection is data-driven.
3. The `test-engineer` agent prompt is platform-agnostic — only the loaded
   template + conventions change.

## References

- Spec: `provider-app/specs/plans/2026-05-18-devkit-cover-spec.md`
- Source plan: `provider-app/specs/plans/2026-05-16-cat-493-test-foundation.md`
- Reference PRs: practo/provider-app#470, practo/provider-app#471
