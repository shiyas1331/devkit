---
description: Scaffold and generate unit tests for a package or file. Platform-aware (react-native today).
argument-hint: <path> [--setup | --batch <name> | --report] OR <single-file>
model: opus
---

# Cover with unit tests — router

This is a thin dispatcher. The picker fires when `$ARGUMENTS` is empty; otherwise the command parses input and delegates to a sub-command. All mode bodies live in `commands/cover/<mode>.md` — they are self-contained.

**Response format — always (except final reports):**
- What was done (max 2-3 bullets)
- Exactly what the developer needs to do right now
- What happens next

Never narrate reasoning. Be terse. Directional.

## Input

```
$ARGUMENTS
```

## Routing rules — apply in order

### 1. Empty input → interactive picker

**Trigger:** `$ARGUMENTS` is empty.

Use the `AskUserQuestion` tool. Do NOT print a menu in text. Do NOT read any help file.

**Question 1 — mode selection:**

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

If the user picked **"Write tests"** AND the path they provide is a directory (not a file), ask **Question 2 — scope:**

```
question: "What scope?"
header: "Scope"
multiSelect: false
options:
  - label: "All slices"
    description: "Every file importing createSlice. High agent confidence — mechanical pattern."
  - label: "All thunks"
    description: "Every createAsyncThunk export — fetch/post/update/delete variants."
  - label: "All hooks"
    description: "Pure hooks, Redux hooks, bottom-sheet hooks. Mixed agent confidence."
  - label: "Services and containers"
    description: "SQLite services and screen containers. Containers are lowest-confidence."
```

**Map answer → sub-command and re-invoke:**

| Mode chosen | Scope chosen | Re-invoke |
|---|---|---|
| Discover | — | `/devkit:cover <path>` |
| Write tests + file | — | `/devkit:cover <file>` |
| Write tests + dir + slices | — | `/devkit:cover <path> --batch slices` |
| Write tests + dir + thunks | — | `/devkit:cover <path> --batch thunks` |
| Write tests + dir + hooks | — | `/devkit:cover <path> --batch hooks` |
| Write tests + dir + svc/cont | — | `/devkit:cover <path> --batch services-containers` |
| Setup foundation | — | `/devkit:cover <path> --setup` |
| Show coverage report | — | `/devkit:cover <path> --report` |

### 2. Help token → delegate to help sub-command

**Trigger:** `$ARGUMENTS` contains `--help`, `-h`, or `?` as a standalone token.

Delegate to `commands/cover/help.md`. Read it and follow its instructions.

### 3. Flag-based input → delegate to flag sub-command

| Pattern | Delegate to |
|---|---|
| `<path> --setup` | `commands/cover/setup.md` |
| `<path> --batch slices` | `commands/cover/slices.md` |
| `<path> --batch thunks` | `commands/cover/thunks.md` |
| `<path> --batch hooks` | `commands/cover/hooks.md` |
| `<path> --batch listeners` | `commands/cover/listeners.md` |
| `<path> --batch services-containers` | `commands/cover/containers.md` |
| `<path> --batch containers` | `commands/cover/containers.md` |
| `<path> --report` | `commands/cover/report.md` |

### 4. Bare file path → single-file mode

**Trigger:** `$ARGUMENTS` ends in `.ts` or `.tsx` and the file exists.

Delegate to `commands/cover/file.md`.

### 5. Bare directory path → discover mode (default)

**Trigger:** `$ARGUMENTS` is a directory path with no recognized flag.

Delegate to `commands/cover/discover.md`.

## Global guardrails (inherited by all sub-commands)

- DO NOT modify source files. Tests describe; they don't fix.
- DO NOT commit. Engineer reviews.
- DO NOT touch files outside the target package.
- DO NOT run `npm test` on the whole repo — only the target package.
- DO use existing fixtures before creating new ones (grep `<PACKAGE_ROOT>/src/__tests__/fixtures/`).
- DO surface latent bugs to the user — they're often more valuable than the coverage itself.

## References

- Spec: `provider-app/specs/plans/2026-05-18-devkit-cover-spec.md`
- Source plan: `provider-app/specs/plans/2026-05-16-cat-493-test-foundation.md`
- Reference PRs: practo/provider-app#470, practo/provider-app#471
