# Changelog

## v1.6.1 (2026-05-20)

### `/devkit:split-pr` — Mode 3 (EXECUTE), multi-language deps, full file lists

Follow-up to v1.6.0 after running it on PR #471 (CAT-494, 143 files) and
hitting three real gaps. v1.6.1 closes them.

> ⚠️ **Validation status — read before relying on v1.6.1:**
>
> Only the TS/JS + GitHub pipeline has been run on a real PR (#471).
> Everything new in v1.6.1 is **spec-only** and ships unvalidated:
>
> - **Mode 3 (`--execute`)** — the stacked `gh pr create` loop has
>   never run. First real use is beta testing.
> - **Kotlin / Java / Python / Go adapters** — regexes are best-effort.
>   Edge cases (typealiases, top-level fns, inline classes, generics
>   in signatures, namespace packages) are not validated.
> - **Swift adapter** — explicitly low-fidelity stub. Returns empty
>   deps; bucketing falls back to path affinity.
> - **Bucketing fixes** — new categorize_file rules were not re-run
>   against PR #471 to confirm fixtures and source files now land
>   in the right buckets.
>
> File issues when you hit edge cases. Treat Mode 3 and non-TS
> adapters as preview-quality until validated in the wild.

#### NEW: Mode 3 — `--execute` (auto-open PRs)

```
SUGGEST (default)   →   analysis only, /tmp artifacts, zero side effects
DRAFT (--draft)     →   create N branches locally (was already in 1.6.0)
EXECUTE (--execute) →   create branches AND open PRs in tier order

Mode 3 picker option added. With --execute:
  1. Confirms with the user once, showing all N PR titles + tiers
  2. Creates branches via the same script as DRAFT
  3. Pushes each branch to origin
  4. Opens PRs in tier order via gh pr create
     - Tier 1 PRs: --base <original base>
     - Tier 2+ PRs: --base <previous tier's branch> (STACKED)
  5. Prints final summary with PR URLs and rollback hint

  Optional: --close-original prints the close command but does NOT
  run it (still manual — closing requires a confirmation review
  the tool shouldn't make for you).
```

#### FIX: Bucketing heuristic — fixtures, setup, source files

Two real bugs spotted on PR #471's run:

```
v1.6.0 problem                       v1.6.1 behavior
─────────────────────────────────────────────────────────────────
test fixtures + setup.ts             test-infrastructure bucket
  → landed in "test" mixed bucket      (test buckets stack on it)

source files like                    per-layer source buckets
useBatchUploadToS3V2.ts                (hooks, media-hooks,
  → landed in "misc"                    containers, slices, api, db)

                                     INVARIANT: source files never
                                     land in misc. If categorize_file
                                     returns "misc" for a .ts/.tsx,
                                     escalate via path-prefix
                                     (hooks/ vs containers/ vs api/).
```

#### NEW: Multi-language import graph (Phase B)

Added language detection + per-language adapter routing. Files that
aren't TS/JS no longer fall into a silent empty graph — they're
either parsed by an adapter or get an explicit "skipped" warning.

```
Language     Adapter                Fidelity                      Status
────────────────────────────────────────────────────────────────────────
TS / JS      parse_ts_imports       HIGH (imports → files)        ✓ 1.6.0
Python       parse_py_imports       HIGH (imports → files)        ✓ NEW
Kotlin/Java  parse_kotlin_imports   MED (imports → packages,     ✓ NEW
                                       resolved to defining file)
Go           parse_go_imports       MED (imports → packages)      ✓ NEW
Swift        parse_swift_imports    LOW (module-level only;       ✓ NEW
                                       returns empty, falls back     (honest
                                       to path affinity)             stub)
other        none                   no graph; path-only          ✓ NEW
                                                                    (explicit
                                                                    warning)
```

**Kotlin adapter** parses `import com.x.y.Foo`, finds the in-PR file
whose `package` declaration matches AND defines `class/object/fun
Foo`. Skips wildcard imports (`com.x.y.*`) and stdlib
(kotlin./java./android./javax.).

**Swift adapter** acknowledges that Swift imports are module-level
only — file-to-file deps within a module are invisible to imports.
Returns empty deps. The SUGGEST output explains this so users know
the dep graph wasn't computed (not silently empty).

**Python and Go adapters** added with high/medium fidelity
respectively.

**Per-PR language summary** printed at the start of Phase B:
`Language detected: kotlin (94), java (12), other (3)`.

#### IMPROVEMENT: SUGGEST output shows full file lists

v1.6.0 truncated to "Examples: <3 files> + N more". Users couldn't
review what's actually in each bucket without re-grepping the JSON.

v1.6.1 prints the full file list per bucket, grouped by common
path prefix to keep it scannable:

```
Bucket B — establishment-slices (12 files, deps: A)
  packages/establishment/src/store/aboutFlow/
    estAboutSlice.ts
    estAddressSlice.ts
    estLogoSlice.ts
    estContactSlice.ts
  packages/establishment/src/store/specialitiesFlow/
    estSpecialitiesSlice.ts
    estServicesSlice.ts
    ...
```

#### NOTES

- GitHub remains the only supported git host. GitLab / Bitbucket
  return an error (documented).
- Kotlin / Swift file-content fetching uses `gh api` per file
  (~0.5s each). For 100+ file Kotlin PRs, Phase B is slower than
  TS PRs. Users can rely on path-only bucketing if they want to
  skip the dep graph.

---

## v1.6.0 (2026-05-20)

### NEW: `/devkit:split-pr` — split large PRs into smaller dependency-aware PRs

Direct follow-up to v1.5.3. When pr-review:post-review detects an oversized
PR, it now recommends splitting — and this command does the splitting.

#### Two modes (Mode 3 deferred to v1.7.0)

```
SUGGEST (default)
  Analysis only — no side effects.
  Outputs:
    • Per-bucket file list with auto-derived names
    • Cross-bucket dependency graph (from import statements)
    • Merge order via topological sort (tiers — parallel vs stacked)
    • Reviewable shell script at /tmp/split-<pr>-script.sh
    • Draft PR descriptions at /tmp/split-<pr>-prs/<id>.md

DRAFT (--draft)
  Runs SUGGEST first, then EXECUTES the script:
    • Creates N branches in the split/<pr>/ namespace
    • Stacked-on bases for buckets with deps
    • All branches local by default; --push to push to origin
  Does NOT open PRs. That's manual via gh pr create (commands provided).

Mode 3 (auto-open PRs):
  Deferred to v1.7.0. Once you've validated DRAFT mode on a real PR,
  Mode 3 layers on top mechanically.
```

#### Dependency-aware bucketing

```
Pipeline:
  1. Path-based bucketing (same as pr-review:post-review v1.5.3)
  2. Parse import / require statements in each in-PR file
  3. Build a directed graph: file → [files it imports from]
  4. Compute cross-bucket edges
  5. Refine:
     • Tightly-coupled buckets (>5 mutual edges) → MERGE
     • Oversized buckets (>25 files) → SPLIT along dep cliques
     • Tests group by directory by default; --include-tests-with-source
       pairs each test with its source file's bucket
  6. Topological sort → merge-order tiers
```

#### Path-alias resolution

```
Resolves @aliased/imports/* via tsconfig.json's compilerOptions.paths.
Falls back to babel.config.js's babel-plugin-module-resolver aliases.
External package imports (e.g., 'react-native') are ignored — they're
stable and create no cross-bucket coupling.
```

#### Honest limitations documented

```
⚠️ Static imports only — misses runtime / dynamic / codegen deps
⚠️ Commit history is squashed per bucket (one commit per branch)
   --preserve-commits is a v2 candidate
⚠️ Shared files end up in ONE bucket (the most-importing one);
   other buckets become stacked on that one
⚠️ Cycle detection: surfaces a warning, merges cycle members into
   one bucket as a fallback
⚠️ Conflict handling is manual once upstream PRs land
⚠️ Tool DOES NOT replace careful authoring — best splits come from
   writing smaller PRs in the first place. This is a recovery tool.
```

#### Safety

```
✅ NEVER touches the original PR's branch
✅ NEVER force-pushes
✅ Verifies working tree is clean before any changes
✅ All new branches in split/<pr>/* namespace for easy cleanup
✅ Confirmation prompt before any branch creation in --draft mode
✅ Rollback command always printed in the summary:
     git branch -D $(git branch | grep '^split/<num>/')
```

#### Composability

```
• pr-review:post-review Phase A.6 detects oversized PR → recommends
  this command
• After split-pr --draft creates branches, run pr-review:post-review
  on each smaller PR to get clean reviews
• Original PR can be closed once all splits are open (manual)
```

---

## v1.5.3 (2026-05-20)

### `/devkit:pr-review:post-review` — oversized PR handling

Triggered by a real-world run on practo/provider-app#471 — 143 files,
~1.38M chars of patches. The agent context window couldn't hold it,
producing zero useful signal. v1.5.3 adds explicit handling for
oversized PRs: detect, suggest split, offer chunked execution as an
escape hatch.

#### Phase A.6 — Size detection + split suggestion (PRIMARY)

```
Default thresholds:
  >30 files  OR  >150,000 patch chars

When triggered:
  • Files are bucketed by top-level path with smart sub-grouping
    (tests/mocks/docs go into their own buckets)
  • Small buckets (<5 files) get merged into "_misc"
  • Cap at 6 suggested buckets total
  • User sees: "Suggested split into N smaller PRs" with concrete
    file examples per bucket
  • User chooses:
      (a) Cancel — split into smaller PRs (recommended, default)
      (b) Review in chunks — let tool handle it
      (c) Force full review — likely poor signal

With --bulk-confirm: defaults to "cancel" — silently posting a
degraded review on an oversized PR is the worst default.
```

#### Phase A.7 — Chunked execution (ESCAPE HATCH)

```
When user chooses "chunked":
  • Run the agent once per bucket
  • Each agent call gets the FULL PR context (description, existing
    comments, prior devkit comments) but only that bucket's files
    in the diff section
  • Aggregate findings across all buckets
  • De-dup at (path, line) — same anchor → keep first finding
  • Merge patterns across buckets (same issue text → combined files
    list)
  • Post as a SINGLE review with all bucket findings

Trade-offs surfaced in the preview:
  ⚠️ Cross-bucket pattern detection is approximate
  ⚠️ Costs N× a normal review (one agent call per bucket)
  ⚠️ Agent cannot reason about cross-bucket coupling
```

#### New flags

```
--max-files=<N>   Override the default 30-file threshold
--chunked          Skip the size prompt; force chunked execution
                   (useful for scripting against known-large PRs)
```

#### What this does NOT do

```
❌ Doesn't AUTO-chunk silently. The split-into-smaller-PRs option is
   strongly recommended and is the default for --bulk-confirm.
❌ Doesn't try to be smart about which files belong together — the
   bucketing is simple top-level path grouping. Good enough for
   actionable suggestions; not perfect.
❌ Doesn't pre-emptively suggest commit boundaries — that's for
   /devkit:split-pr (future command, not in this release).
```

#### Trade-offs documented

```
• Chunked mode loses some cross-bucket signal:
    - A pattern that appears once per bucket but is repeated across
      buckets may not get flagged as a pattern
    - Coupling between files in different buckets is invisible to
      the agent (it only sees one bucket at a time)
  These are honest limitations of chunking. Splitting the PR is
  always the better path.

• Threshold defaults (30 files, 150k chars) are heuristic. Power
  users can tune via --max-files=N. Threshold based on observed
  behavior: PR #470 (20 files, ~150k chars) worked fine; PR #471
  (143 files, ~1.38M chars) crashed the agent.
```

---

## v1.5.2 (2026-05-20)

### `/devkit:pr-review:post-review` — re-run handling + confidence cue

Addresses two problems observed in v1.5.1:
  1. Re-running on the same PR posted duplicate comments (no prior-review
     awareness)
  2. Type-2 hallucinated findings (agent invents issues that aren't real)
     had no defense beyond the prompt's "skip if uncertain" rule

#### Re-run handling — three coordinated changes

```
Phase A.5 — Prior-review detection
  Before posting, check for prior comments tagged 🤖 [devkit:pr-review].
  If found, show a choice via AskUserQuestion:
    (a) Delta   — review only what's new since my last review
    (b) Force   — re-review the entire PR (agent still dedups against
                  prior findings)
    (c) Cancel  — bail out cleanly
  
  With --bulk-confirm, defaults to "delta" mode (safer than silently
  posting duplicates).

Phase B.5 — Smart delta narrowing (when "delta" mode chosen)
  For each file in the current PR diff:
    • Not previously commented on  → review in full (new territory)
    • Previously commented + has new commits → narrow patch to lines
      added/changed since prior review commit
    • Previously commented + unchanged → skip
  
  If everything is unchanged since prior review:
    Halt with "No new code since my last review on <date>. Nothing
    to post."

Phase C — Pass prior devkit comments to the agent
  New section in the prompt template: "PRIOR REVIEW BY ME". The agent
  sees its own prior findings with rules:
    • Don't duplicate identical findings if the code hasn't changed
    • DO re-raise if the issue persists in a new form
    • DO surface new issues introduced in the current diff
    • Empty array is valid if nothing's wrong
  
  This is SEPARATE from the existing human-comments section — devkit's
  own prior output should be treated as a re-review signal, not as
  "humans already raised this."
```

Net behavior: re-runs on the same PR no longer noisily duplicate. User
gets an explicit choice. Default to scoped delta in interactive mode,
to delta in --bulk-confirm.

#### What we explicitly did NOT add

```
❌ Auto-resolve prior devkit comments
   Considered, rejected. "Outdated" in GitHub's UI doesn't mean
   "addressed" — auto-resolving could hide unfixed issues. That stays
   the author's call.
```

#### Confidence cue per comment

Heuristic defense against Type-2 (finding) hallucination — claims that
look plausible but aren't actually true.

```
Phase D step 6 — compute confidence per finding
  • Body has absolute claims ("will fail", "will throw") with no
    code-anchoring in the patch  →  low
  • Body has hedged language ("might", "consider") + good anchoring
    → high
  • Severity "must" + hedge in body → medium (the agent itself is
    uncertain)
  • Quoted identifiers in body don't appear in the file's patch →
    low signal that the agent referenced something not in the diff

Phase E preview shows the cue per comment:
  [3] [consider] [confidence: low] src/baz.tsx (line 12, RIGHT)
      ⚠️ Low confidence — verify manually before posting
      <body excerpt>...

The cue does NOT auto-drop findings. User sees it in the preview and
decides what to keep. This is intentional — false negatives are worse
than verbose previews.
```

#### Trade-offs

```
• Confidence heuristic is approximate. Catches obvious cases (absolute
  claims without anchoring) but misses subtle hallucinations (claims
  that anchor to real code but are factually wrong about its behavior).
  Real verification (second-pass agent, tool-call lookups) deferred
  to v1.7.0 if real-world signal demands it.

• Smart-delta narrowing relies on GitHub's compare API for the
  prior-commit..HEAD diff. Works for typical PRs; force-pushed PRs may
  produce stale narrowing if the prior commit is no longer reachable.

• "Delta" mode skips files unmodified since prior review. If the prior
  review missed a real issue in an unchanged file, this run won't
  catch it. "Force" mode is the escape hatch.
```

---

## v1.5.1 (2026-05-20)

### `/devkit:pr-review:post-review` — fixes from first real-world run

v1.5.0 was tested on practo/provider-app#470. Three real issues surfaced;
this release fixes all three. Numbers reference the actual observed
behavior on that PR.

#### Fix 1 — Line-number hallucination (the big one)

```
Symptom (v1.5.0):
  Agent produced 5 findings on PR #470. All 5 had line numbers
  that DID NOT EXIST in the diff:
    package.json:309        (file has 16 mappable lines)
    setup.ts:442            (file has 81 lines total)
    self-serve.tsx:166      (file has 40 mappable lines)
    PostEducationDetail:572 (file has 220 mappable lines)
    jest.config.js:219      (file has 92 mappable lines)
  
  All 5 findings dropped at Phase D as "unmapped." Empty output.
  Had to manually re-prompt the agent with explicit valid-line ranges
  before it produced usable output.

Root cause:
  The agent saw the diff but had no clear signal about which line
  numbers were actually anchored. It picked plausible-looking numbers
  for typical files.

Fix:
  Phase B now ALSO builds a compact valid-line-ranges hint (compressed
  ranges like "lines 7-15, 77-83"). Phase C's prompt template now
  injects this hint between the project conventions and the diff,
  with explicit language: "every `line` value MUST be from this list".
  
  Tested in the re-prompt run: agent produced 6 findings, 5 of which
  mapped correctly to actual file lines. No more hallucination.
```

#### Fix 2 — Length cap raised from 400 → 500 chars

```
Symptom (v1.5.0):
  A substantive 417-char finding on setup.ts (about NativeModules
  shared-state leakage across tests) got silently dropped by the
  >400 cap. Real engineering issue, lost to the filter.

Root cause:
  400 chars was too tight. The cap is meant to defend against verbose
  agent output, not drop technical findings that need a couple of
  sentences to explain.

Fix:
  Cap raised to 500. The 417-char finding would now pass through.
  Other defenses (bullet-list filter, whitespace-only filter) unchanged.
```

#### Fix 3 — Switch from `position` to `line` + `side: "RIGHT"`

```
Symptom (v1.5.0):
  Comments posted successfully, but GitHub displayed them ±1 line
  from the agent's intent. The agent said line 10 in package.json;
  GitHub showed the comment at line 11. Five out of five comments
  drifted by 1 line in the displayed view.

Root cause:
  The `position` field anchors to the unified-diff offset, not the
  new-file line. GitHub renders the comment at whatever line the
  position lands on in its diff view, which can be off-by-one from
  the agent's intended target.

Fix:
  Payload now uses `line` (the new-file line number directly) plus
  `side: "RIGHT"` (the new file). GitHub's modern API supports this
  shape and anchors precisely. The position map stays in Phase B
  but only as a membership check (verify the line is in the diff)
  — it's no longer passed to the API.
```

#### Backward compat

```
• All existing flags work the same way
• No behavior change for the prose-brief modes (default/quick/save/post)
• Only --post-review behavior changed
• Re-runs still self-dedup via the 🤖 [devkit:pr-review] tag
```

---

## v1.5.0 (2026-05-20)

### `/devkit:pr-review:post-review` — true inline comments anchored to diff positions

The `--post-review` flow previously produced a prose brief and tried to map
its sections to inline comments. This release replaces that with a focused
JSON-driven flow that posts diff-anchored review comments via the GitHub
reviews API.

#### What changes for users

```
Before (v1.4.x):
  • One prose brief generated by the full default.md pipeline
  • Section-to-comment mapping was approximate — many comments lost
    their anchoring because the brief was written for human reading,
    not for diff positions
  • Per-comment confirmation prompts → tedious for any non-trivial PR

After (v1.5.0):
  • Agent generates JSON-only output: {comments, patterns}
  • Each comment maps to an exact diff position (GitHub's anchoring system)
  • Default: one preview, one confirmation, post all
  • --bulk-confirm: skip preview, post immediately
  • Severity-labeled ([must] / [consider])
  • Cross-file deduplication into a "Patterns found" section in the
    review body
```

#### Quality-of-output features

```
Context awareness:
  • Fetches PR title + body so the agent doesn't re-raise issues the
    author already acknowledged
  • Fetches existing human reviewer comments so the agent doesn't
    duplicate what humans already pointed out
  • Filters out prior 🤖 [devkit:pr-review] comments so re-runs work
    correctly (otherwise the agent would see its own output as
    "already raised")

Senior-reviewer mindset (in the prompt):
  • What TO comment on: logic bugs, security issues, perf, missing
    error handling, genuinely confusing naming
  • What NOT to comment on: linter-style nits, "not how I'd do it",
    every changed line
  • Tone: direct but not harsh; suggest rather than demand
  • Signal-to-noise: 3-8 comments is typical, 0-2 if code is clean,
    empty array is a valid honest answer

Severity labels:
  • [must]     — actual bug or will-break-something (blocking)
  • [consider] — suggestion or improvement (non-blocking)
  Agent emits in JSON; posting layer prefixes the body.

Cross-file dedup:
  • If the same TYPE of issue appears in 3+ files, the agent picks
    one representative example and adds the rest to a "Patterns" array
  • Patterns surface in the review body so the author knows to fix
    all occurrences
```

#### Mechanics

```
Phase A: Fetch PR meta + per-file patches + existing comments via gh api
         Filter out generated/vendored files (lock files, dist/, generated/)
         Filter out prior devkit-tagged comments

Phase B: Build {filename: {new_file_line: diff_position}} map from each
         file's `patch` field — uses GitHub's diff-position rules
         (1-indexed, counts every line after the first @@ header)

Phase C: Agent prompt produces JSON-only output with comments + patterns

Phase D: Post-process — validate shape, drop bodies > 400 chars or with
         bullet lists (defense against verbose agent), map line → position,
         drop unmapped, prefix severity, suffix devkit tag

Phase E: Preview + confirm (default) OR skip preview (--bulk-confirm)

Phase F: Post single review with event=COMMENT via atomic POST
         If 422 on specific comments → remove + retry ONCE
         If retry fails → abort with full error

Phase G: Summary with counts by severity, by file, and drop reasons
```

#### Quality safeguards built in

```
✅ Atomic API + retry-after-filter (one retry, no infinite loops)
✅ Length cap (drop bodies > 400 chars or with bullet lines)
✅ Generated-file path exclusion (lock files, dist/, generated/, min.js)
✅ Self-dedup on re-runs (filter prior devkit-tagged comments)
✅ Always event=COMMENT (never REQUEST_CHANGES or APPROVE)
✅ Context-depth discipline ("if 3-line context isn't enough, skip")
```

#### Compat

```
• --focus=<glob> — still narrows file scope
• --since=<commit> — still narrows to commits after the SHA
• --no-jira — accepted, no effect (kept for backwards compat)
• --depth=<quick|thorough> — accepted, no effect (post-review has no
                              prose brief, so depth doesn't apply)
• --bulk-confirm — new meaning: skip preview, post immediately
                   (previously: one y/n for entire review)
```

#### Not changed in this release

```
• /devkit:pr-review:default and :quick still produce prose briefs
  unchanged (uses default.md pipeline)
• /devkit:pr-review:save still writes the brief to disk unchanged
• /devkit:pr-review:post still posts the prose brief as a single
  summary comment unchanged
• Only :post-review (and the bare --post-review flag) changed
```

---

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
