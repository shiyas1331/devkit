---
description: Generate a senior-architect-level review brief for a pull request — pre-answers "why" questions from git history, triages files by attention need, surfaces conventions and risks
argument-hint: <PR url, PR number, or branch name> [--depth=quick] [--focus=<glob>] [--since=<commit>] [--save[=<path>]] [--post] [--post-review] [--bulk-confirm] [--no-jira]
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
- `--post` — implies `--save`; after writing, ask permission then post brief as a single summary PR comment
- `--post-review` — post a full GitHub review with **inline comments** at relevant file:lines plus a summary body. Confirms each inline comment individually by default.
- `--bulk-confirm` — used with `--post-review`; ask once for the whole batch instead of per-comment
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

## Phase 2: Initial analysis — only what's needed

Spawn agents conditionally. Each one fires only when it has work to do; never spawn unnecessarily.

### A. Codebase Locator (always)

Use `subagent_type: "devkit:codebase-locator"` (fallback: Glob + Read). Prompt:
> Find files related to this PR's scope: <PR title + one-line description>. Identify slices, screens, hooks, services, tests touched or adjacent. Surface cross-cutting dependencies.

### B. Convention Checker (conditional — only if convention docs exist)

**Gate:** spawn only if any of these files exist in the repo:
- `CLAUDE.md`
- `.claude/codebase/*.md`
- `CONTRIBUTING.md`
- `STYLE.md`

If none exist, **skip** this agent and note `convention check: skipped (no convention docs)` in the brief's footer.

Otherwise use `subagent_type: "devkit:convention-checker"` (fallback: Read + Grep inline). Prompt:
> Check this PR's diff against the conventions documented in <list of files found>. Output ✅ matches and ⚠️ deviations with file:line and severity (blocker / discuss / nit).
>
> Diff: <inline diff or file paths>

A and B run in parallel (they're independent).

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

## Phase 3b: Targeted analysis — only what's actually needed

Now that triage is done, spawn the agents that are gated on triage outputs. These only fire if they have specific work — no general "analyze everything" calls.

### Codebase Analyzer per 🔴 file (conditional)

For each file in the 🔴 bucket, spawn `subagent_type: "devkit:codebase-analyzer"` (fallback: Grep + Read). Prompt:
> Trace execution flow for <file>. Identify what calls into it, what it calls, what state it touches. Flag risks introduced by the diff.

If the 🔴 bucket is empty, skip entirely. Most PRs have 0–2 🔴 files.

### Per-finding history — `/devkit:why` (conditional, capped)

Identify candidate "decisions inferred" findings — places where the diff makes a non-obvious choice (e.g., adds `retry: 0`, moves dispatch from thunk to listener, picks one pattern over an existing alternative). For each such candidate, invoke `/devkit:why <file:line>` to fetch the historical context.

**Cap at 7 invocations** per PR by default (configurable later). Beyond 7, fall back to inline `git log --oneline -5 -- <file>` summaries — cheaper and good enough for the marginal cases.

If a finding has no `--depth=quick` history value (e.g., it's pure forward-looking risk, not a "why" question), don't invoke `/devkit:why` for it.

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

If `--post-review` (full GitHub review with inline comments):

1. **Build the review payload** by mapping brief sections:

   | Brief section | Becomes |
   |---|---|
   | TL;DR + Risk + Triage + Decisions inferred + Suggested verification | Review summary `body` |
   | Each Convention deviation with file:line | Inline comment at that file:line |
   | Each Risk highlight with file:line | Inline comment at that file:line |
   | Each Open question with file:line | Inline comment at that file:line |

   Skip any finding without a concrete file:line — those stay in the summary only.

2. **Tag every inline comment** with a visible marker so the author can distinguish tool-generated from human comments. Prefix each comment body with: `🤖 [devkit:pr-review]\n\n`

3. **Validate every file:line** against the latest commit's diff before queuing. Drop comments whose line doesn't exist in the latest commit (stale lines from older commits in the PR). Note dropped count in the confirmation prompt.

4. **Cap inline comments per file** at 5 by default. Excess findings on the same file go into the summary body as `**Additional notes on <file>**`.

5. **Confirm before posting:**
   - Default: per-comment. Show each inline comment as `[N/M] <file:line>: <body>` and ask `(y / n / edit / cancel-review)`. `cancel-review` aborts the whole post.
   - With `--bulk-confirm`: show a numbered list of all inline comments + the summary body, ask one `(y / n)` for the entire review.

6. **Submit as a single review** via:
   ```
   gh api repos/<org>/<repo>/pulls/<num>/reviews \
       -f event=COMMENT \
       -F body='<summary>' \
       -F 'comments[]={"path":"<path>","line":<N>,"body":"<text>"}' \
       -F 'comments[]={...}'
   ```
   Always `event: COMMENT`. Never `REQUEST_CHANGES` or `APPROVE` — let humans block or approve.

7. **Print a summary** of what was posted: `Posted review with <N> inline comments + summary. <M> findings stayed in summary only (no concrete file:line). <D> dropped (stale lines).`

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
| `--post-review` finds no inline-eligible items | All findings stay in summary only. Halt with: "No inline-eligible findings; use `--post` instead for a summary comment." |
| `--post-review` would post > 20 inline comments | Warn: "This review would post <N> inline comments. Bulk-confirm? (y/n/cancel)". Never silently post a large batch. |
| File:line in finding doesn't match latest commit | Drop the inline comment. Track dropped count for the confirmation summary. |

## Composability

- **CodeRabbit** — defer line-level nits to it; note in "Convention check": "see CodeRabbit for line-level feedback".
- **`/devkit:why <file:line>`** — invoked internally during Phase 3b for per-finding historical context. The reviewer can also run it standalone for ad-hoc "why does this exist?" questions.
- **`/devkit:trace`** — suggest in "Suggested verification" if runtime behavior needs confirmation.
- **`/devkit:address-pr`** — author runs after review feedback to apply fixes.

### Agent invocation summary

| Agent | When |
|---|---|
| `devkit:codebase-locator` | Always (Phase 2A) |
| `devkit:convention-checker` | Phase 2B — only if CLAUDE.md / `.claude/codebase/*.md` / CONTRIBUTING.md / STYLE.md exists |
| `devkit:codebase-analyzer` | Phase 3b — only for files in 🔴 bucket after triage |
| `/devkit:why` (sub-command) | Phase 3b — only for findings needing historical "why", capped at 7 per PR |

Small PR with no conventions → 1 agent call. Large PR with critical paths and strong conventions → 9–12 agent calls. Cost scales with PR complexity.

## Output personality

- File:line references on every claim.
- Confidence labels mandatory on inferences.
- 5 high-confidence inferences beat 15 low-confidence ones — admit uncertainty.

## Example

```
/devkit:pr-review 409                  # prints full brief to terminal
/devkit:pr-review 409 --save           # also writes specs/reviews/PR-409-<slug>.md
/devkit:pr-review 409 --post           # writes file, asks before posting single summary comment
/devkit:pr-review 409 --post-review    # posts a full review with inline comments at file:lines (per-comment confirm)
/devkit:pr-review 409 --post-review --bulk-confirm   # one y/n for the whole review
```
