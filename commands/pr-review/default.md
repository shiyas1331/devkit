---
description: Full PR review brief — TL;DR, triage, decisions, conventions, risks. Default mode when invoked with a bare PR identifier.
argument-hint: <PR url, PR number, or branch name>
model: opus
---

# /devkit:pr-review:default — full brief (canonical pipeline)

Equivalent to `/devkit:pr-review <PR>` (bare PR identifier, no flag). This file is the **canonical pipeline** — other `pr-review/*` sub-commands (`quick`, `save`, `post`, `post-review`, `since`) reference it and modify only the output stage.

**Response format:** one short sentence on what was done, the next concrete action, terse.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"PR? (URL, number, or branch — e.g. 409 or feat/CAT-260-foo)"`.

Accept any of: GitHub PR URL, PR number (resolve via current repo's origin), branch name (resolve via `gh pr list --head <branch>`).

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

### Codebase Analyzer per 🔴 file (conditional)

For each file in the 🔴 bucket, spawn `subagent_type: "devkit:codebase-analyzer"` (fallback: Grep + Read). Prompt:
> Trace execution flow for <file>. Identify what calls into it, what it calls, what state it touches. Flag risks introduced by the diff.

If the 🔴 bucket is empty, skip entirely.

### Per-finding history — `/devkit:why` (conditional, capped)

Identify "decisions inferred" findings — places where the diff makes a non-obvious choice. For each candidate, invoke `/devkit:why <file:line>` to fetch the historical context.

**Cap at 7 invocations** per PR by default. Beyond 7, fall back to inline `git log --oneline -5 -- <file>` summaries.

If a finding has no historical "why" value (pure forward-looking risk), don't invoke `/devkit:why` for it.

## Phase 4: Generate brief

Output a single markdown document. **Do not improvise the format**:

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

- ⚠️ <what was unavailable>
```

## Phase 5: Output (full mode — print to terminal)

Default behavior for `/devkit:pr-review:default`:
- Print the full brief to the terminal. Don't write any files.

Sub-commands that override this stage:
- `pr-review/quick.md` — print only TL;DR + Triage table
- `pr-review/save.md` — write to `specs/reviews/PR-<num>-<slug>.md` + print TL;DR
- `pr-review/post.md` — save + post as a summary PR comment (with confirmation)
- `pr-review/post-review.md` — post as full GitHub review with inline comments
- `pr-review/since.md` — same pipeline but with `--since=<commit>` filter on the diff

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
| Author == reviewer | Drop "Open questions for author." Replace with "Self-checks". |
| Stacked PR (base ≠ main) | Surface dependency in header. Brief covers ONLY this PR's specific diff. |
| First PR by author | Note in header. Extra rigor in "Convention check". |
| `gh` not authenticated | Halt: "Run `gh auth login` and retry." |
| Empty diff | Note "PR has no diff." Skip analysis. |
| Existing brief on re-run | Show diff between old and new. Ask whether to overwrite. With `--since`, append delta section instead. |

## Composability

- **CodeRabbit** — defer line-level nits to it; note in "Convention check": "see CodeRabbit for line-level feedback".
- **`/devkit:why <file:line>`** — invoked internally during Phase 3b. The reviewer can also run it standalone.
- **`/devkit:trace`** — suggest in "Suggested verification" if runtime behavior needs confirmation.
- **`/devkit:address-pr`** — author runs after review feedback to apply fixes.

### Agent invocation summary

| Agent | When |
|---|---|
| `devkit:codebase-locator` | Always (Phase 2A) |
| `devkit:convention-checker` | Phase 2B — only if CLAUDE.md / `.claude/codebase/*.md` / CONTRIBUTING.md / STYLE.md exists |
| `devkit:codebase-analyzer` | Phase 3b — only for files in 🔴 bucket after triage |
| `/devkit:why` (sub-command) | Phase 3b — only for findings needing historical "why", capped at 7 per PR |

Small PR with no conventions → 1 agent call. Large PR with critical paths and strong conventions → 9–12 agent calls.

## Output personality

- File:line references on every claim.
- Confidence labels mandatory on inferences.
- 5 high-confidence inferences beat 15 low-confidence ones — admit uncertainty.

## Guardrails

- Read-only on the codebase. Never modifies source.
- DO NOT post anything to GitHub from this sub-command — that's `post.md` / `post-review.md`.
- DO NOT commit.
