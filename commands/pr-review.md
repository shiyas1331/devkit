---
description: Generate a senior-architect-level review brief for a pull request — pre-answers "why" questions from git history, triages files by attention need, surfaces conventions and risks
argument-hint: <PR url, PR number, or branch name> [--depth=quick] [--focus=<glob>] [--since=<commit>] [--save[=<path>]] [--post] [--no-jira]
model: opus
---

# PR Review Brief

Reviewer-side tool. Author does nothing. Mine git history + codebase patterns + linked tickets to pre-answer "why did you do this" questions, triage files by attention need, and surface conventions / risks. Goal: 60-second TL;DR + drilldown that lets the reviewer skip 80% of the diff.

**Response format:** one short sentence on what was done, the next concrete action, terse.

## Input

PR identifier: $ARGUMENTS

Accept any of: GitHub PR URL, PR number (resolve via current repo's origin), branch name (resolve via `gh pr list --head <branch>`).

Flags:
- `--depth=quick` — TL;DR + Triage only
- `--focus=<glob>` — narrow to matching files
- `--since=<commit>` — re-review mode; only diff after the commit
- `--save` — also write brief to `specs/reviews/PR-<num>-<slug>.md` (default: terminal only)
- `--save=<path>` — write to a specific path
- `--post` — implies `--save`; after writing, ask permission then post brief as PR comment
- `--no-jira` — skip JIRA lookup

If `$ARGUMENTS` is empty, ask: "Which PR? Provide a URL, number, or branch name."

## Context Loading

Read if present: `CLAUDE.md`, `.claude/codebase/*.md`, `CONTRIBUTING.md`, `STYLE.md`. These define the conventions to check against.

## Phase 1: Fetch context (parallel; degrade gracefully)

1. **PR metadata** — `gh pr view <PR> --json number,title,body,author,baseRefName,headRefName,additions,deletions,changedFiles,labels,reviews,createdAt`. If `gh` not auth'd, halt: "Run `gh auth login` and try again."
2. **Diff** — `gh pr diff <PR>`. If `--since=<commit>`: `git diff <commit>...HEAD`.
3. **Per-file history** (top 10 most-changed files) — `git log --oneline -10 -- <file>` and `git blame -C -C -C` on changed line ranges.
4. **Linked ticket** — parse PR title + branch for ticket IDs (use `TICKET_PREFIXES` env var if set, else `CAT|COVEX|JIRA|PROJ|ENG`). If found and `--no-jira` not set, fetch via Atlassian API using `ATLASSIAN_TOKEN` and `ATLASSIAN_USER`. Skip silently on missing creds; track in "Degraded context".
5. **Similar past PRs** — extract 3-5 keywords from PR title; `gh pr list --state merged --search "<keyword>" --limit 5`.

Track failures for the "Degraded context" section.

## Phase 2: Analyze (parallel agents)

### A. Codebase Locator
Use `subagent_type: "devkit:codebase-locator"` (fallback: Glob + Read). Prompt:
> Find files related to this PR's scope: <PR title + one-line description>. Identify slices, screens, hooks, services, tests touched or adjacent. Surface cross-cutting dependencies.

### B. Codebase Analyzer (run only on 🔴 files after Phase 3)
Use `subagent_type: "devkit:codebase-analyzer"` (fallback: Grep + Read). Prompt:
> Trace execution flow for <file>. Identify what calls into it, what it calls, what state it touches. Flag risks introduced by the diff.

### C. Git History Analyzer (inline)
For each significant changed line range: read originating commit message, follow PR references via `gh pr view`, capture explicit "why" stated in description or review comments. Synthesize into candidate decisions, each with: decision, inferred reason, `confidence` (`high`/`medium`/`low`), `source` (commit/PR/ticket/file:line). For deeper per-line archaeology, defer to `/devkit:why <file:line>`.

### D. Convention Checker
Walk CLAUDE.md / repo rules. For each rule, check diff compliance. Examples: language mandates ("new native must be Kotlin"), banned imports ("don't add Volley"), test coverage (new function → test exists?), error/logging/naming conventions. Output `✅ matches` and `⚠️ deviations`, each with file:line.

## Phase 3: Triage

Score each changed file 0–3 on three axes:
- **Criticality** — payments / auth / prescription / doctor verification = high; UI, docs = low. Cross-reference `CRITICAL_PATHS.md` if present.
- **Risk** — API boundary, store shape, public exports, retry logic, new external dependencies = high.
- **Magnitude** — by lines changed: <20 = 0, 20–100 = 1, 100–500 = 2, >500 = 3.

Total = `criticality × 2 + risk × 2 + magnitude`.

| Score | Bucket |
|---|---|
| ≥ 8 | 🔴 Read carefully |
| 4–7 | 🟡 Skim |
| < 4 | 🟢 Skip |

Overall PR risk: 🔴 if any file is 🔴 with `criticality ≥ 2`; 🟡 if any file is 🟡; else 🟢.

## Phase 4: Generate brief

Output a single markdown document. **Do not improvise the format** — reviewers build muscle memory on consistent layout.

```markdown
# PR Review Brief — <PR title>

**@<author>** • `<head>` → `<base>` • <changedFiles> files / +<additions> -<deletions> • Risk: <emoji> <Low/Medium/High>

> <PR description first sentence, or "(no description provided)">

## TL;DR (60-sec read)

- **What it does:** <1 sentence>
- **Why (inferred):** <1 sentence with confidence tag>
- **User-facing impact:** <Yes / No / Indirect — what>
- **Where to focus:** <comma-separated, max 3 files>

## Behavior change

- **Before:** <plain English>
- **After:** <plain English>

## Triage

🔴 **Read carefully** (<N> files)
- `path/to/file.tsx` — <reason in 5–10 words>

🟡 **Skim** (<N> files)
- `path/to/file.ts` — <reason>

🟢 **Skip** (<N> files)
- formatting / generated / dependency bumps / etc.

## Decisions inferred from history

(3–7 most relevant. Drop anything without a verifiable source.)

1. **<the decision>**
   - Inferred: <why>
   - Confidence: `high` / `medium` / `low`
   - Source: <commit hash, PR link, ticket ID, or file:line>

## Open questions for the author

(Only the unanswerable-from-history ones. 0–5 max. If none, write: "No open questions — history covers all decisions.")

- <Specific, code-grounded question with file:line reference>

## Convention check

✅ **Matches**
- <e.g., "Uses Practo error code structure">

⚠️ **Deviations**
- <Convention violated> at `path:line` — severity: blocker / nit / discuss

## Risk highlights

- <Specific risk> at `path:line`

## Suggested verification

- Manually test: <user flow>
- Run: `<scoped test command>`
- Post-merge: monitor Sentry for <error class> / staging metric for <signal>

## Similar past PRs

(0–3 if found.)

- **PR #<num>** (`<short-sha>`) — <title>. Outcome: <merged / reverted / partial>. <relevant note>

## Degraded context

(Include only if any fetch step failed.)

- ⚠️ <what was unavailable, e.g., "JIRA lookup failed — ticket context unavailable">
```

## Phase 5: Output

Default (no `--save`, no `--post`):
- Print the full brief to the terminal. Don't write any files.

If `--save` (or `--save=<path>`, or `--post` which implies `--save`):
- Write to the given path, or `specs/reviews/PR-<num>-<short-title-slug>.md` if no path specified. Create the directory if missing.
- Print: file path, TL;DR section verbatim, one-line next-step suggestion.

If `--post`:
- Show first 30 lines of the brief, ask: `"Post as comment on PR #<num>? (y/n)"`.
- On `y`, run `gh pr comment <PR> --body-file <path>`.
- Never post without explicit confirmation.

## Phase 6: Quality gates (before writing)

1. Every "Decision inferred" has a verifiable `source`. Drop ones that don't.
2. No section contradicts the diff. Re-read.
3. TL;DR ≤ 6 short bullets.
4. Triage doesn't say "skip" for any file with > 50 changed lines unless formatting/generated.
5. Open questions aren't pseudo-questions answerable from history.
6. Convention deviations verified against actual rule text in CLAUDE.md.

If any gate fails, fix before output.

## Edge cases

| Case | Behavior |
|---|---|
| PR > 1000 lines | Auto-chunk by feature area or top-level folder; per-chunk briefs synthesized into final. Note in "Degraded context." |
| No PR description | Note `(no description provided)`. Lean harder on diff + ticket + history. |
| No linked JIRA / lookup fails | Skip ticket sections. Note in "Degraded context". |
| Force-pushed PR | Run `git reflog` on branch. Note in header. Lower confidence on history-based inferences. |
| Author == reviewer | Drop "Open questions for author." Replace with "Self-checks": tests run, manual verification done. |
| Stacked PR (base ≠ main) | Surface dependency in header. Brief covers ONLY this PR's specific diff. |
| First PR by author | Note in header. Extra rigor in "Convention check". |
| `gh` not authenticated | Halt: "Run `gh auth login` and retry." |
| Empty diff | Note "PR has no diff." Skip analysis. |
| Existing brief on re-run | Show diff between old and new. Ask whether to overwrite. With `--since`, append delta section instead. |

## Composability

- **CodeRabbit** — defer line-level nits to it; note in "Convention check": "see CodeRabbit for line-level feedback".
- **`/devkit:why <file:line>`** — for deep per-line archaeology when a single decision needs more digging.
- **`/devkit:trace`** — suggest in "Suggested verification" if runtime behavior needs confirmation.
- **`/devkit:address-pr`** — author runs after review feedback to apply fixes.

## Output personality

- File:line references on every claim.
- Confidence labels mandatory on inferences.
- 5 high-confidence inferences beat 15 low-confidence ones — admit uncertainty.

## Example

```
/devkit:pr-review 409                # prints full brief to terminal
/devkit:pr-review 409 --save         # also writes specs/reviews/PR-409-<slug>.md
/devkit:pr-review 409 --post         # writes file, asks before posting as PR comment
```
