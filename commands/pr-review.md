---
description: Generate a senior-architect-level review brief for a pull request — pre-answers "why" questions from git history, triages files by attention need, surfaces conventions and risks
argument-hint: <PR url, PR number, or branch name> [--depth=quick] [--focus=<glob>] [--since=<commit>] [--post] [--no-jira]
model: opus
---

# PR Review Brief

You are tasked with producing a calibrated, senior-architect-level review brief for a pull request. Your goal is to give the reviewer a 60-second TL;DR plus drilldown sections that pre-answer ~80% of "why did you do this" questions, so they can focus their attention on what actually matters.

This is a **reviewer-side tool**. The author does nothing. You infer intent from git history, codebase patterns, and linked tickets — never ask the author to prepare anything.

**Response format — always:**
- One short sentence describing what was just done
- The next concrete action you're taking (or asking the user for)
- Be terse. The reviewer is busy.

## Input

PR identifier: $ARGUMENTS

Parse for any of:
- A GitHub PR URL (`https://github.com/<org>/<repo>/pull/<num>`)
- A PR number (`123` — resolve against current repo's origin remote)
- A branch name (`feat/CAT-260-foo` — locate via `gh pr list --head <branch>`)

Optional flags within the argument string:
- `--depth=quick` — TL;DR + Triage only (faster); default is full brief
- `--focus=<glob>` — narrow analysis to matching files
- `--since=<commit>` — only consider diff after the given commit (re-review mode)
- `--post` — after generating, ask permission then post brief as a PR comment via `gh pr comment`
- `--no-jira` — skip JIRA lookup even if a ticket ID is detected

If `$ARGUMENTS` is empty, ask: "Which PR? Provide a URL, number, or branch name."

## Context Loading

Before analysis, read available repo context:
1. `CLAUDE.md` at repo root (if exists)
2. `.claude/codebase/*.md` (if exists)
3. `CONTRIBUTING.md` / `STYLE.md` at repo root (if present)

These define the conventions you'll check against.

## Phase 1: Fetch context (parallel)

Run these in parallel. Each must degrade gracefully if its source is unavailable.

1. **PR metadata via `gh`**:
   ```
   gh pr view <PR> --json number,title,body,author,baseRefName,headRefName,additions,deletions,changedFiles,labels,reviews,createdAt
   ```
   If `gh` is not authenticated or the PR is inaccessible, halt with: "Run `gh auth login` and try again."

2. **Diff**:
   - Default: `gh pr diff <PR>`
   - If `--since=<commit>`: `git diff <commit>...HEAD`

3. **Per-file history** (top 10 most-changed files in the PR):
   - `git log --oneline -10 -- <file>`
   - `git blame` on changed line ranges only

4. **Linked ticket** (best effort):
   - Parse PR title + branch name for ticket IDs (`CAT-XXX`, `COVEX-XXX`, generic `[A-Z]+-\d+`).
   - If found and `--no-jira` is not set, attempt fetch via Atlassian API using `ATLASSIAN_TOKEN` and `ATLASSIAN_USER` env vars.
   - If creds missing or fetch fails, skip silently and note in "Degraded context".

5. **Similar past PRs**:
   - Extract 3-5 keywords from the PR title.
   - `gh pr list --state merged --search "<keyword>" --limit 5`
   - Capture title + number + outcome (merged / reverted) for each.

If any single fetch fails, continue with the rest. Track failures for the "Degraded context" section.

## Phase 2: Analyze (parallel agents)

### A. Codebase Locator

Use `subagent_type: "devkit:codebase-locator"`. If unavailable, use Glob + Read directly. Prompt:

```
Find files related to this PR's scope: <PR title and one-line description>.
Identify slices, screens, hooks, services, tests touched or adjacent.
Surface cross-cutting dependencies that this PR's changes might affect.
```

### B. Codebase Analyzer (selective — only after triage)

Run only for files marked 🔴 Critical by Phase 3 triage. Use `subagent_type: "devkit:codebase-analyzer"`. Prompt:

```
Trace execution flow for this changed file: <file>.
Identify what calls into it, what it calls, and what state it touches.
Flag unusual patterns or risks introduced by the diff.
```

### C. Git History Analyzer (inline)

For each significant changed line range:

- Read the originating commit's message.
- If the commit references a PR (`#<num>`), read that PR's description and review-thread comments via `gh pr view <num>` and `gh api repos/<org>/<repo>/pulls/<num>/comments`.
- Capture any explicit "why" stated by the author or reviewers.

Synthesize into candidate decisions, each with:
- The decision (what was chosen)
- Inferred reason (from history)
- Confidence: `high` (explicit in commit message / ticket / review comment), `medium` (consistent with codebase pattern), `low` (best guess)
- Source: file:line, commit hash, PR link, or ticket ID

### D. Convention Checker

For each rule in CLAUDE.md / repo conventions, check whether the diff complies. Examples to look for:

- Language-specific mandates (e.g., "new native code must be Kotlin")
- Banned imports / patterns (e.g., "don't add Volley calls")
- Test coverage requirements (new function added → corresponding test exists?)
- Error-handling conventions, logging conventions, naming conventions

Produce a list of `✅ matches` and `⚠️ deviations`, each linked to a file:line.

## Phase 3: Triage

Score each changed file on three axes (0–3 each):

1. **Criticality** — payments / auth / prescription / doctor verification = high; UI tweaks, doc changes = low. Cross-reference any `CRITICAL_PATHS.md` if present.
2. **Risk** — API boundary changes, store shape changes, public exports modified, retry logic touched, new external dependencies = high.
3. **Magnitude** — based on lines changed: <20 = 0, 20–100 = 1, 100–500 = 2, >500 = 3.

Total score = `criticality × 2 + risk × 2 + magnitude`.

| Score | Bucket |
|---|---|
| ≥ 8 | 🔴 Read carefully |
| 4–7 | 🟡 Skim |
| < 4 | 🟢 Skip |

Compute overall PR risk:
- 🔴 if any file is 🔴 AND its criticality ≥ 2
- 🟡 if any file is at least 🟡
- 🟢 otherwise

## Phase 4: Generate brief

Output a single markdown document. **Do not improvise the format.** Reviewers build muscle memory on consistent layout.

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

1. Write the brief to `specs/reviews/PR-<num>-<short-title-slug>.md`. Create the directory if it does not exist.

2. Print to the user:
   - File path written
   - The TL;DR section verbatim (5 lines max)
   - One line of next-step suggestions

3. If `--post` was provided:
   - Show the first 30 lines of the brief.
   - Ask: "Post this as a comment on PR #<num>? (y/n)"
   - On `y`, run `gh pr comment <PR> --body-file <path>`.
   - Never post without explicit confirmation, even with `--post`.

## Phase 6: Quality gates (self-check before writing)

Verify these before output. If any fails, fix the brief; do not output a flawed one.

1. Every "Decision inferred" has a verifiable `source` field. Drop any that don't.
2. No section claims something contradicted by the diff. Re-read the diff.
3. TL;DR is genuinely under 60 seconds (≤ 6 short bullets).
4. Triage doesn't say "skip" for any file with > 50 lines changed unless those lines are formatting/generated.
5. Open questions are not pseudo-questions. If history could have answered it, move it to "Decisions inferred."
6. Convention deviations are real — verified against actual rule text in CLAUDE.md.

## Edge cases

| Case | Behavior |
|---|---|
| PR > 1000 lines | Auto-chunk by feature area or top-level folder. Generate per-chunk briefs. Final brief synthesizes them. Note in "Degraded context." |
| No PR description | Note "(no description provided)" under header. Lean harder on diff + ticket + history. |
| No linked JIRA / lookup fails | Skip ticket sections. Mark in "Degraded context". |
| Force-pushed PR | Run `git reflog` on the branch. Note in header. Lower confidence on history-based inferences. |
| Author == reviewer (self-review) | Drop "Open questions for the author." Replace with "Self-checks": tests run, manual verification done. |
| Stacked PR (base ≠ main/master) | Surface dependency in header. Brief covers ONLY this PR's specific diff. |
| First PR by author | Note in header. Add extra rigor in "Convention check". |
| `gh` not authenticated | Halt early: "Run `gh auth login` and re-try." |
| Empty diff | Note "PR has no diff." Skip analysis. |
| Re-run on same PR (existing brief) | Show diff between old and new brief. Ask whether to overwrite. With `--since`, append a delta section instead. |

## Composability

Reference these in the brief where appropriate (don't duplicate their work):

- **CodeRabbit comments** — in "Convention check," note "see CodeRabbit comments for line-level feedback" and skip line-level nits.
- **`/devkit:trace`** — in "Suggested verification," reference if a runtime trace would clarify behavior.
- **`/devkit:codebase-analyzer`** — in triage notes for 🔴 files, suggest invoking it for deep-dive understanding.
- **Author follow-up** — at the brief's end, note: "After review, the author can address feedback systematically with their preferred tool."

## Output personality

- Direct, not verbose.
- No marketing language ("comprehensive", "powerful", "amazing" — banned).
- File:line references for every claim.
- Confidence labels are mandatory on inferences.
- If uncertain, say so. 5 high-confidence inferences beat 15 low-confidence ones.
