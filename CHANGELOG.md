# Changelog

## v1.4.9 (2026-05-19)

### `/devkit:locator-add` — four fixes that lift auto-instrument rate

Based on deep-dive analysis of `/devkit:locator-add` against omega/self-serve
(86 components, 33 auto-instrumented in PR #142 = 43% rate) and provider-app
(399 component files, never auto-instrumented).

#### Fix 1 — Intersection-type bug (correctness)

**Problem**: when a component's props type was an intersection (`Props & Omit<X>`),
the transform updated the destructure + JSX but skipped the type update —
producing TypeScript compile errors in the consumer project.

**Fix**: bail cleanly when type annotation is `TSIntersectionType` (or any
unsupported shape). Stderr message tells the dev to add fields manually.

**Impact**: prevents broken builds. provider-app has 13 components at risk.

#### Fix 2 — memo() and React.memo() unwrap

**Problem**: `findComponentCandidates` only recognized direct arrow/function
expressions. Components wrapped in `memo(fn)` or `React.memo(fn)` were silently
skipped — never even surfaced as candidates.

**Fix**: new `unwrapHocCalls()` helper that recognizes `memo`, `React.memo`,
`forwardRef`, `React.forwardRef`, and `observer`. Recursively unwraps to find
the inner function. Handles compound chains like `memo(forwardRef(fn))`.

**Impact**: unblocks ~38 components in provider-app (heavy `memo` user) and
the Loader component in omega/self-serve.

#### Fix 3 — forwardRef() unwrap (with generic-arg type support)

**Problem**: `forwardRef(fn)` was skipped entirely (same root cause as Fix 2).
Even worse, the typical pattern `forwardRef<RefType, PropsType>(fn)` encodes
the props type via generics, not via the inner function's param annotation —
so a naive unwrap would produce code that destructures testID without
updating the type.

**Fix**: shared HoC unwrap (with Fix 2). Plus capture the second generic
type argument of forwardRef calls and use it as a fallback when the inner
function's first param has no explicit type annotation.

**Impact**: unblocks Input.tsx (highest-traffic component in omega) plus 1
forwardRef file in provider-app. Handles BOTH `forwardRef<R, P>((props, ref) => ...)`
and `forwardRef((props: P, ref) => ...)` correctly.

#### Fix 4 — Sibling Types.ts patching (multi-file mutation)

**Problem**: many components in self-serve and provider-app put their props
type in a separate file (Button.tsx + ButtonTypes.ts). The transform only
looked in the current file and skipped when the type wasn't found.

**Fix**: new `trySiblingTypesFile()` helper. When the props type reference
isn't found in the current file, search the same directory for sibling type
files in priority order:
  - `<ComponentName>Types.ts` / `.tsx`
  - `<ComponentName>Type.ts` / `.tsx`
  - `types.ts` / `.tsx`

If a sibling file contains the named interface/type alias, patch it directly
(add `testID?: string` and `accessibilityLabel?: string`). Then continue with
normal current-file instrumentation. Reports the patched sibling via stderr.

**Impact**: unblocks ~46 components across both repos. Most-used components
including Button, Radio, Tags, TagWithIcon, ListWithActions in self-serve.

**Caveat — dry-run support**: sibling-file writes happen via direct `fs`
calls, which bypass jscodeshift's `--dry` flag. To respect dry-run for
sibling files, set env var `DEVKIT_LOCATOR_ADD_DRY=1`. The command markdown
should be updated to forward this when `--dry-run` is requested.

### Verification

All 4 fixes verified end-to-end on synthetic fixtures covering:
- Cross-file type (sibling Types.ts patching)
- memo() wrapper
- forwardRef() with generic-arg props
- forwardRef() with param-annotation props
- Intersection type (correctly bails)

Result: **4 ok / 3 skipped / 0 errors** on the test suite. Expected omega
rate after v1.4.9: ~70%. provider-app: ~50-60% (first-ever run).

### Not yet shipped

- Compound `memo(forwardRef(...))` test coverage — should work via the chain
  unwrap but not directly verified on a fixture yet
- App-mode scoping (auto-skip screens/containers) — deferred to a future
  release
- Indirect export (`const X = ...; export { X }`) — deferred

Expected workflow now: run on omega/self-serve, then on provider-app, iterate
based on actual results.

---

## v1.4.8 (2026-05-19)

### Slim-router refactor extended to `pr-review`, `address-pr`, `why`

Same picker-latency fix v1.4.7 applied to `cover` — now applied to the three other commands that have pickers. Parent `.md` files were 261-364 lines; now ~75-100 lines each.

#### Pattern: canonical pipeline lives in `<command>/default.md`

For these commands, every sub-command runs the **same pipeline** — they differ only at the output stage. So instead of inlining the full pipeline into each sub-command (cover's pattern), the pipeline lives once in `<command>/default.md`. Other sub-commands reference it and override only the output phase. Avoids the ~2400 lines of duplication that strict self-containment would have produced.

#### `commands/pr-review.md` (364 → 100 lines)

- Slimmed to router only
- New `pr-review/default.md` — canonical Phase 1-6 pipeline
- New `pr-review/help.md` — verbose flag reference dispatcher
- Existing `quick.md`, `save.md`, `post.md`, `post-review.md`, `since.md` updated to reference `default.md` instead of parent

#### `commands/address-pr.md` (261 → 80 lines)

- Slimmed to router only
- New `address-pr/default.md` — canonical Phase 1-8 pipeline (walk-through mode)
- New `address-pr/help.md`
- Existing `dry-run.md`, `ignore-bots.md`, `auto-resolve.md` updated to reference `default.md`

#### `commands/why.md` (325 → 95 lines)

- Slimmed to router only
- New `why/default.md` — canonical Phase 1-6 pipeline (quick mode)
- New `why/help.md`
- Existing `thorough.md`, `json.md` updated to reference `default.md`

#### Speed-up

Picker now loads ~75-100 lines per command before firing `AskUserQuestion`, vs 250-364 before. 3-4x faster for all three commands.

#### Behavior preserved

- All flag-based invocations unchanged
- All sub-command shortcuts still work
- No external API changed

#### Skipped (intentionally)

- `trace.md` (403 lines) — modes are input variants, not actions per v1.4.6 design decision
- `locator-add.md` (210 lines) — only 1 distinct mode, no sub-command pattern applies

---

## v1.4.7 (2026-05-19)

### `/devkit:cover` — slim router refactor

Picker latency complaint: `/devkit:cover` (empty input) was loading the entire 547-line `cover.md` before rendering the `AskUserQuestion` picker. Now it loads ~100 lines.

#### What changed in `commands/cover.md`

- **Stripped all mode bodies** (Modes A-E, latent-bugs prompt, persistence, hands-off). These were duplicated across `cover/<name>.md` sub-commands anyway.
- **Kept only**: front-matter, picker (front door A), routing table, global guardrails, references.
- **Result**: 547 → ~110 lines. ~5x less context to ingest before the picker fires.

#### Three new sub-commands

Previously these modes lived ONLY in `cover.md` and had no sub-command twin. Now they're self-contained:

- `/devkit:cover:discover` — bare directory path (was Mode B inline)
- `/devkit:cover:file` — bare `.ts`/`.tsx` file path (was Mode C inline)
- `/devkit:cover:help` — `--help` / `-h` / `?` token (was front door B inline)

#### Existing sub-commands updated

The 7 existing sub-commands (`setup`, `slices`, `thunks`, `hooks`, `listeners`, `containers`, `report`) previously pointed at `cover.md` → `Mode X` for the pipeline body. Those references would have dangled after slimming. Each is now **fully self-contained** — its mode body, the latent-bugs prompt, persistence rules, and hands-off block are all inlined.

#### Behavior preserved

- `/devkit:cover` (empty) — picker fires (faster)
- `/devkit:cover <path>` — discover mode (routes to `cover:discover`)
- `/devkit:cover <file>` — single-file mode (routes to `cover:file`)
- `/devkit:cover <path> --setup` — routes to `cover:setup`
- `/devkit:cover <path> --batch <name>` — routes to `cover:<name>`
- `/devkit:cover <path> --report` — routes to `cover:report`
- `/devkit:cover --help` — routes to `cover:help`

No external API changed. Sub-commands continue to work standalone.

---

## v1.4.6 (2026-05-19)

### Extend sub-command pattern to `pr-review`, `address-pr`, and `why`

Following v1.4.5's `/devkit:cover:*` sub-commands, the same delegation pattern now applies to the three other high-traffic commands. Parent `.md` files (pickers) stay unchanged — sub-commands are additive shortcuts that show up in autocomplete BEFORE pressing Enter.

**Skipped:** `trace` (modes are input variants, not actions — picker reads better) and `locator-add` (only 1 distinct mode worth a shortcut — not worth a folder).

#### `commands/pr-review/` — 5 sub-commands
- `/devkit:pr-review:quick` — `--depth=quick` (TL;DR + triage only)
- `/devkit:pr-review:save` — `--save` (write brief to `specs/reviews/PR-<num>-<slug>.md`)
- `/devkit:pr-review:post` — `--post` (post as single summary comment; confirms first)
- `/devkit:pr-review:post-review` — `--post-review` (native GitHub review with inline comments)
- `/devkit:pr-review:since` — `--since=<commit>` (re-review mode for the diff after a specific commit)

Niche flag `--no-jira` intentionally not promoted to a sub-command — power-user flag, not a primary workflow.

#### `commands/address-pr/` — 3 sub-commands
- `/devkit:address-pr:dry-run` — `--dry-run` (preview classification + proposed actions; no writes)
- `/devkit:address-pr:ignore-bots` — `--ignore-bots` (skip CodeRabbit / dependabot / danger / etc.)
- `/devkit:address-pr:auto-resolve` — `--auto-resolve` (mark threads resolved after fixes land without per-thread confirmation)

Reviewer-filter flag (`--reviewer=<login>`) intentionally not promoted — requires a second arg, doesn't fit the simple shortcut shape.

#### `commands/why/` — 2 sub-commands
- `/devkit:why:thorough` — `--depth=thorough` (full drilldown with PR description + review-thread debate)
- `/devkit:why:json` — `--json` (machine-readable output)

Default-quick mode is what `/devkit:why <target>` already does — no `quick.md` sub-command needed.

### Pattern summary

```
commands/cover.md          + commands/cover/        (7 sub-commands)   ← v1.4.5
commands/pr-review.md      + commands/pr-review/    (5 sub-commands)   ← v1.4.6
commands/address-pr.md     + commands/address-pr/   (3 sub-commands)   ← v1.4.6
commands/why.md            + commands/why/          (2 sub-commands)   ← v1.4.6
commands/trace.md          (picker only — input variants don't fit shortcuts)
commands/locator-add.md    (picker only — only 1 distinct mode)
```

All parent `.md` files stay unchanged. Sub-commands are thin delegators (~25 lines each) that pre-select a flag and reference the parent's pipeline.

## v1.4.5 (2026-05-19)

### Add `/devkit:cover:*` sub-commands for direct-to-batch invocation

Adds 7 nested slash commands so modes are visible in the autocomplete dropdown *before* pressing Enter — instead of being hidden behind the picker.

Files (each is a thin shortcut delegating to `commands/cover.md` Mode A / D / E):
- `commands/cover/setup.md` → `/devkit:cover:setup` — Mode A (foundation scaffold)
- `commands/cover/slices.md` → `/devkit:cover:slices` — Mode D batch=slices
- `commands/cover/thunks.md` → `/devkit:cover:thunks` — Mode D batch=thunks
- `commands/cover/hooks.md` → `/devkit:cover:hooks` — Mode D batch=hooks (all 3 sub-classifications)
- `commands/cover/listeners.md` → `/devkit:cover:listeners` — Mode D batch=listeners (with recorder-middleware reminder)
- `commands/cover/containers.md` → `/devkit:cover:containers` — Mode D batch=containers (LOW-confidence warning included)
- `commands/cover/report.md` → `/devkit:cover:report` — Mode E (coverage delta + latent bug summary)

**The original `/devkit:cover` (picker) stays unchanged.** Sub-commands are additive — power users skip the picker, new users still get it. Both paths exist forever.

### Why nested folders

Subdirectory becomes part of the command name via the `:` separator. `commands/cover/slices.md` registers as `/devkit:cover:slices` — visually consistent with the existing `devkit:` namespace pattern. Autocomplete sorts them together because of the shared prefix:

```
/devkit:cover            (the picker, unchanged)
/devkit:cover:setup
/devkit:cover:slices
/devkit:cover:thunks
/devkit:cover:hooks
/devkit:cover:listeners
/devkit:cover:containers
/devkit:cover:report
```

Cleaner than flat `cover-slices.md` because top-level `commands/` stays uncluttered.

## v1.4.4 (2026-05-18)

### Fix: listener template uses recorder middleware (not `jest.spyOn`)

Real-world discovery from running the CAT-494 listener batch (8 files / 269 tests / 25 latent bugs):

**`jest.spyOn(store, 'dispatch')` does NOT intercept dispatches from inside listener effects.** The listener middleware captures the original `dispatch` reference at `configureStore()` time. The spy replaces the public property *after* creation, but the listener already holds the original function — so internal `listenerApi.dispatch(...)` calls bypass the spy entirely.

Without this fix, generated listener tests look correct (no syntax errors, jest runs them) but every assertion silently fails because the listener never reports its dispatches. Each agent run was hitting this and using one of its 2 retries to discover it.

**Fix:** replaced the `jest.spyOn(store, 'dispatch')` pattern in the template with a **recorder middleware** appended to the middleware chain. Recorder middleware is part of the chain itself, so every action — including listener-dispatched ones — flows through it and gets captured.

Also added an explicit "Two gotchas the agent should always remember" callout:
1. Do NOT mock the trigger thunk modules — the listener uses `actionCreator.match(action)` which fails on stubbed thunks
2. NEVER use `jest.spyOn(store, 'dispatch')` for listeners — always recorder middleware

Files:
- `platforms/react-native/templates/listener.template.md` — template + worked `educationListener` example both rewritten with recorder middleware pattern
- `.claude-plugin/plugin.json` — bumped to 1.4.4

## v1.4.3 (2026-05-18)

### Fix: bump `.claude-plugin/plugin.json` version

The marketplace reads version from `plugin.json`, not git tags. Versions v1.4.1 and v1.4.2 were tagged on GitHub but the manifest stayed at `1.4.0`, so `claude plugin update` correctly reported "already at the latest version (1.4.0)" — frustrating but technically right.

This release bumps the manifest to match the changelog. No functional code changes vs v1.4.2.

**Lesson** (added to project memory): when releasing a Claude Code plugin, ALWAYS update `.claude-plugin/plugin.json` `version` field alongside the changelog + git tag — three things in sync.

## v1.4.2 (2026-05-18)

### Listener test template + agent-assigned priorities + auto memory prompt

**Three things in one release** — all stemming from real CAT-494 friction.

**1. Listener test template** — for Redux Toolkit `createListenerMiddleware` files (e.g. `educationListener.ts`). Closes the gap where the slice subtree coverage in `provider-app/packages/editors` was sitting at 42% because 8 listener files weren't testable with the existing slice/thunk/hook templates.

- `platforms/react-native/templates/listener.template.md` — new template covering install-middleware → dispatch-trigger → await-flush → assert-spy with the `educationListener` worked example (page-1 vs page>1 branch + SQLite error-swallow path)
- `commands/cover.md` — discovery rules now classify `createListenerMiddleware` files and `*Listener.ts` files as `listener` classification; inventory JSON adds a `listeners` bucket
- `platforms/react-native/conventions.md` — new section 13 documents the listener test pattern

**2. Agent assigns priority + category to every latent bug**

- `agents/test-engineer.md` — agent's JSON output now includes `priority` (`P0`/`P1`/`P2`/`P3`) and `category` (`stale-closure`, `math-random-id`, `numeric-sort-string-id`, etc.) per bug
- Full P0–P3 rubric in the agent prompt: P0 = every-user impact, P1 = specific-path issues, P2 = edge cases, P3 = cosmetic
- Eliminates manual priority triage after every batch — known categories are auto-tagged from the 65-bug taxonomy built during CAT-494

**3. Auto-prompt to add latent bugs to memory** — fixes a UX papercut where the user had to manually ask "add these to memory" after every batch.

- `commands/cover.md` — Modes C (single file) and D (batch) now auto-trigger an `AskUserQuestion` whenever `latent_bugs.length > 0`
- Three choices: "Yes — all with priorities" / "Yes — only P0/P1" / "Skip"
- If yes, writes to `memory/<package>-latent-bugs.md` with a priority-index table + detailed entries + a MEMORY.md pointer line

All three changes compose: the listener template generates bugs → the agent tags them with priorities + categories → the command prompts to persist them. Zero manual book-keeping.

## v1.4.1 (2026-05-18)

### Fix: inline template + conventions into agent prompts

Parent command now reads templates and conventions ONCE per batch and inlines the content into each `test-engineer` agent's prompt. Removes the path-based handoff that only worked when devkit was installed at a hardcoded local path.

- `agents/test-engineer.md` — agent reads only `SOURCE_FILE`; `TEMPLATE_PATH` / `CONVENTIONS_PATH` replaced with inlined `TEMPLATE:` / `CONVENTIONS:` blocks in the prompt
- `commands/cover.md` — Mode C (single file) and Mode D (batch) updated: parent reads template + conventions once, inlines content into every agent call instead of passing absolute paths

Net effect: agents are now fully self-contained and portable across machines / plugin installations (plugin cache, local clone, anywhere). Also avoids redundant file reads when batching — for a 20-file batch, saves 40 file reads (2 per agent).

## v1.4.0 (2026-05-18)

### New command: `/devkit:cover`

Automated unit-test scaffolding and generation. Platform-aware (react-native first; react/android/ios/node/java to follow). Grounded in `provider-app/packages/editors` (PR #470 foundation + #471 doctor profile coverage — 512 tests / 56 suites across 22 slices, 25 thunks, hooks, services, containers, plus 3 latent production bugs surfaced).

Target: 60–70% time savings on subsequent packages. A medium-sized package that took ~1 work week of manual test work should drop to ~1.5 days with the tool.

Files:
- `commands/cover.md` — orchestrator with modes: discover, write tests (single-file or batch), setup foundation, report
- `agents/test-engineer.md` — per-file agent: reads source, picks template, writes test, runs jest, retries failures, structured JSON output. Spawned in parallel pools by the parent command.
- `platforms/react-native/` — first platform adapter
  - `detect.md` — RN detection rules with positive + negative signals
  - `conventions.md` — AAA, factories, mock-at-boundary, ref pattern, `as never` cast, latent-bug surfacing
  - `templates/` — slice, thunk, hook-pure, hook-redux, hook-bottomsheet, service, container
  - `scaffolds/` — jest.config, setup.ts, createTestStore, renderWithProviders, navigationMock
  - `mocks/` — reanimated, safe-area-context, @practo/self-serve, fast-image (foundation set; extendable per package)
- `references/help/cover.md` — verbose flag reference for power users

Architecture leaves room for `platforms/react/`, `platforms/android/`, `platforms/ios/`, `platforms/node/`, `platforms/java/` — each is a drop-in folder with the same shape. The command and agent stay platform-agnostic.

Phase 1 MVP. Phase 2 (live agent execution + batch mode polish) and Phase 3 (additional platforms) ride in follow-up versions.

### Mode picker migrated to native `AskUserQuestion` across all commands

The previous "read help file → print menu → ask for a number" pattern was slow and gated discovery behind users typing `--help`. Migrated all six commands to use the native `AskUserQuestion` tool:

- Empty invocation now ALWAYS opens an interactive picker — no `--help` needed to discover modes.
- Option descriptions include concrete examples so the choice is obvious at a glance.
- `--help` / `-h` / `?` still works for power users who want the full flag reference.
- Direct flag invocations (e.g. `/devkit:cover packages/X --setup`) skip the picker entirely.

Migrated commands:
- `commands/cover.md` — 2 chained questions (mode → scope)
- `commands/trace.md` — 1 question (input type)
- `commands/why.md` — 1 question (depth)
- `commands/pr-review.md` — 2 chained questions (action → depth)
- `commands/address-pr.md` — 1 question (mode)
- `commands/locator-add.md` — 1 question (mode)

Old picker pattern (loading external help file, parsing typed numbers) removed from all commands.

### Earlier in this release cycle: `/devkit:locator-add` (originally cut on 2026-04-29 — never tagged)

Auto-instruments React Native library components with `testID` and `accessibilityLabel` props plus default derivation from semantic props (`text` / `label` / `placeholder`). After running on a library like `@practo/self-serve`, every consumer call site automatically gets a sensible testID — no per-call-site work in app code.

- jscodeshift-based codemod over `.tsx`/`.jsx`/`.ts`/`.js` files
- Library mode only (v1) — app/consumer code is not touched
- Detects native-primitive JSX roots (`TouchableOpacity`, `Pressable`, `TextInput`, `Switch`, etc.) and instruments them
- List-row pattern: components named `*Item`/`*Row`/`*Card` get a hardcoded role testID (e.g. `establishment-row`) plus accessibilityLabel forwarded from a name prop
- Idempotent: safe to re-run; instrumented files are skipped on subsequent runs
- Cross-file safety: when a component's props type lives in another file, the tool warns and skips rather than producing TS errors
- Generates a `<library>/src/utils/locator.ts` helper if missing
- Flags: `--dry-run`, `--naming role|screen|full` (only `role` does anything in v1)
- Tested with 8 fixture-based snapshot tests (Jest)

Files:
- `commands/locator-add.md`
- `references/help/locator-add.md`
- `scripts/locator-add.js` (the actual jscodeshift transform)
- `scripts/__tests__/locator-add.test.js`
- `package.json`, `babel.config.js` (devkit now has Node deps)

Future phases (deferred): app-mode collision detection, Android Compose, iOS SwiftUI, React web, page-object generation.

## v1.3.8 (2026-04-29)

### Mode picker is now the front door (no `--help` needed)

Renamed "help mode" to "mode picker" because that's what it actually is. The picker now triggers whenever no flag is passed — even if a PR/target is provided. So `/devkit:pr-review 409` shows the menu with PR pre-selected; the user just types a number.

Power users who want a specific invocation pass any `--*` flag and bypass the picker entirely (e.g. `/devkit:pr-review 409 --post-review` runs directly).

New: **mode combinations** via comma syntax. `2,4 409` runs option 2 + option 4. Mutually-exclusive picks (e.g. READ category 1↔2, POST category 4↔5) are surfaced and resolved.

Help reference files now include a combination hint at the bottom of each scenario menu so users discover the syntax.

### Trace exception
`/devkit:trace` only triggers the picker on empty input or `--help`. Any text/screenshot/log input is the actual command (no flags to combine).

## v1.3.7 (2026-04-29)

### Help becomes an interactive scenario picker, externalized to `references/help/`

Static `--help` text dumps replaced with a numbered scenario menu where users pick a mode by number. Help content extracted to `references/help/<command>.md` so command files stay focused on orchestration.

- New: `references/help/pr-review.md`, `address-pr.md`, `why.md`, `trace.md` — each contains a scenario menu, number→command mapping, and a verbose flag reference.
- Each command's help-mode block now does ~10 lines: read the help file, print the menu, parse the user's numbered reply.
- `?` (or `flags`, `full`) reveals the verbose flag reference for power users.
- Bare invocation prints the menu instead of asking "which PR?" — discovery without docs.

User experience: `/devkit:pr-review --help` now shows numbered options like "5. Post a full review with inline comments [recommended for real reviews]" — reply with `5 409` to run.

## v1.3.6 (2026-04-29)

### `--help` / `-h` support across all commands

Every devkit command now responds to `--help`, `-h`, or `?` with a concise usage doc — no need to hunt the README. Bare invocation also prints help instead of cryptic prompts.

- `/devkit:pr-review --help`
- `/devkit:address-pr --help`
- `/devkit:why --help`
- `/devkit:trace --help`

Each help text covers: usage examples, flag descriptions in plain English, and 2-3 example invocations. Same discoverability pattern as `gh --help`, `git --help`, etc.

## v1.3.5 (2026-04-29)

### `/devkit:pr-review` — conditional agent spawning + new convention-checker agent

Cleaned up Phase 2 of `pr-review` so agents only spawn when they have actual work to do. Cost now scales with PR complexity (small PR = 1 agent call; large complex PR = 9–12).

- **New agent** `devkit:convention-checker` — reusable across `pr-review`, the planned `/devkit:review`, and `/devkit:address-pr`. Reads convention docs, checks diff against each rule, classifies deviations by severity (`blocker`/`discuss`/`nit`).
- **Phase 2B gating** — Convention Checker only spawns if convention docs exist (`CLAUDE.md`, `.claude/codebase/*.md`, `CONTRIBUTING.md`, `STYLE.md`). Otherwise skipped silently.
- **Phase 3b new** — Codebase Analyzer fires only on 🔴 files (typically 0–2 per PR). Was previously described as "after triage" but sequencing was contradictory.
- **`/devkit:why` per-finding gating** — invoked only for findings genuinely needing historical "why" context, capped at 7 per PR. Beyond the cap, falls back to cheap inline `git log --oneline`.
- **Removed "Git History Analyzer" framing** — it was a label, not a real agent. Replaced with explicit `/devkit:why` invocations in Phase 3b.

## v1.3.4 (2026-04-29)

### `/devkit:pr-review` — `--post-review` mode (inline comments)

The brief now translates findings into a real GitHub PR review: a summary body + inline comments at the relevant file:lines, posted as a single review.

- New `--post-review` flag — full GitHub review with inline comments. Each comment confirmed individually before posting (default behavior; safer than bulk).
- New `--bulk-confirm` flag — combines with `--post-review` for one y/n on the entire batch instead of per-comment.
- Inline comments tagged with `🤖 [devkit:pr-review]` prefix so authors distinguish tool-generated from human feedback.
- Always posts as `event: COMMENT` — never blocks merge with `REQUEST_CHANGES` or auto-approves.
- Validates every file:line against the latest commit before posting; drops stale-line comments.
- Caps inline comments per file at 5; excess findings move to the summary as `Additional notes on <file>`.
- Warns before posting a review with > 20 inline comments.
- Halts gracefully if no findings have concrete file:line references — suggests `--post` instead.

## v1.3.3 (2026-04-29)

### `/devkit:pr-review` — file output is now opt-in

Default behavior changed: the brief is printed to the terminal only. No files are written unless explicitly asked for. Reduces friction for one-shot reviews and avoids polluting repos.

- New `--save` flag — also write to `specs/reviews/PR-<num>-<slug>.md` (the previous default location).
- New `--save=<path>` — write to a custom path.
- `--post` now implies `--save` (a file is needed for `gh pr comment --body-file`).
- `/devkit:address-pr` continues to read from `specs/reviews/` if a brief exists there.

## v1.3.2 (2026-04-28)

### Refactor — `/devkit:pr-review` and `/devkit:address-pr`

Trimmed both command prompts ~27% with no behavior change. Removed verbose phase intros, redundant calibration reminders, and multi-paragraph philosophy explanations. Kept verbatim: output format templates, edge case tables, quality gates, agent-reference patterns — the parts that enforce consistency. Easier to maintain when adding flags or updating conventions.

## v1.3.1 (2026-04-28)

### Improvements to `/devkit:why`
- **Iterative line-history walk** — most recent commit on a line is often a typo fix or refactor; the command now walks back through history to find the substantive originator. Trivial-commit classifier (typo/format/lint/rename/bot) skips noise.
- **Mechanical confidence labels** (`high`/`medium`/`low`/`none`) with concrete criteria — no more judgment-call inconsistency.
- **PR attribution fix** — filters to merged PRs and picks the earliest, so cherry-picks/backports don't get attributed as the originator.
- **Authoritative squash-merge detection** via PR's `merge_method` field instead of fragile commit-message pattern matching.
- **Distance-filtered review comments** (≤ 10 lines from target) with documented fallback when nothing matches.
- **Configurable ticket prefixes** via `TICKET_PREFIXES` env var to prevent ghost tickets from over-permissive regex.
- **Generated-file detection** with explicit path patterns and content sniffing.
- **Working-tree drift warnings** when the user's line points to unstaged changes.
- **Submodule auto-descend** instead of halting.
- **Confidence in JSON output** for downstream consumers.

## v1.3.0 (2026-04-28)

### Commands
- `/devkit:why` — Explain why a piece of code exists. Pulls git blame, the originating commit, the merging PR's description, the linked JIRA ticket, and review-thread highlights into one grounded answer. Detects special cases: reverted code, superseded PRs, line moves, renames, squash merges, direct-to-main pushes.

## v1.2.0 (2026-04-28)

### Commands
- `/devkit:address-pr` — Author-side companion to `/devkit:pr-review`. Reads open reviewer comments, classifies them (change-request / nit / question / suggestion / praise / out-of-scope / stale / conflict), drafts code fixes and replies, commits in smart batches, posts replies, resolves threads, and re-requests review — all with author approval at every step.

## v1.1.0 (2026-04-28)

### Commands
- `/devkit:pr-review` — Senior-architect-level review brief for a pull request. Pre-answers "why" questions from git history, triages files by attention need, surfaces convention violations and risks. Reads PR via `gh`, mines `git blame` / `git log` / linked JIRA tickets / similar past PRs.

## v1.0.0 (2026-04-20)

Initial release.

### Commands
- `/devkit:trace` — Auto-instrumented debugging across Android, iOS, React Native, Web, Java, Python

### Skills
- `trace-nudge` — Auto-suggests `/trace` when manually adding debug logs

### Agents
- `codebase-locator` — Find files by topic
- `codebase-analyzer` — Trace execution flow and data paths
- `codebase-pattern-finder` — Find similar implementations and patterns
- `web-search-researcher` — Research library docs and known issues
