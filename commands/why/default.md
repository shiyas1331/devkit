---
description: Quick "why does this code exist" explanation — one paragraph + sources + walk summary. Default mode when invoked with a bare target.
argument-hint: <file:line> or <file>
model: opus
---

# /devkit:why:default — quick why (canonical pipeline)

Equivalent to `/devkit:why <target>` (bare target, no flag). This file is the **canonical pipeline** — other `why/*` sub-commands (`thorough`, `json`) reference it and modify only the output stage.

**Response format — always:**
- Start with the answer (one paragraph). The first sentence is the "why."
- Surface the walk: "Walked back N commits to find the originating change."
- Be direct. No marketing language.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"Target? (e.g. apiClient.ts:188, or apiClient.ts:120-150 for a range)"`.

Parse for:
- `file:line` — explain that line (most common)
- `file` alone — explain the file's existence (its first substantive commit)
- `file:line-range` (e.g. `apiClient.ts:120-150`) — explain the block

Optional flag (default sub-command supports this directly):
- `--max-walk=N` (default 5) — cap on how far back to walk through line history

## Phase 1: Validate

1. File exists. Else halt: `File <path> not found.`
2. Line in range (if specified). Else halt: `Line <N> out of range; file has <X> lines.`
3. Detect generated/vendored file (path matches `node_modules/`, `vendor/`, `Pods/`, `build/`, `dist/`, `generated/`, `*.lock`, `package-lock.json`, OR first 5 lines contain "auto-generated" / "do not edit"). If detected, prefix output with `⚠️ This file appears generated/vendored. History may be auto-generated.` Continue anyway.
4. Submodule check: if path is in a submodule, note it and auto-descend to run inside the submodule rather than halting.
5. Working-tree drift: compare the target line at HEAD vs working tree. If they differ, prefix output with `⚠️ Line <N> has unstaged changes. Showing history of what's in HEAD.`

## Phase 2: Walk line history (the core)

This is the precision-critical step. The user wants the substantive "why," not the most recent typo fix.

### Step 1 — Get full line history

For a file:line target:
```
git log --follow -L <line>,<line>:<file> --pretty=format:'COMMIT %H%n%an%n%ae%n%ad%n%s%n%b%nENDCOMMIT' --date=iso
```

For a line-range target: same with `<start>,<end>` instead of `<line>,<line>`.

For a file-only target (no line): use the file's full log:
```
git log --follow --pretty=format:'COMMIT %H%n%an%n%ae%n%ad%n%s%n%b%nENDCOMMIT' --date=iso -- <file>
```

Use `--follow` so renames are tracked transparently. For line-range queries, also use `git blame -C -C -C -L <start>,<end> -- <file>` as a secondary check to catch content moved across files.

### Step 2 — Classify each commit as substantive or trivial

A commit is **trivial** if any of these match:

- Subject matches `/^(typo|fix typo|style|format|lint|whitespace|chore|rename|cleanup|reformat|prettier|eslint|sort imports|remove unused)\b/i`
- Subject contains `cherry-pick` or `revert` (these point elsewhere — surface but keep walking)
- Author email matches a bot pattern: `noreply@`, `*[bot]@*`, `dependabot`, `renovate`, `*-bot@*`
- Commit modifies > 100 files in one go (likely a sweeping refactor, not feature work)

A commit is **substantive** otherwise. (When uncertain — e.g., subject is just "update apiClient.ts" — classify as substantive but tag confidence as `low`.)

### Step 3 — Identify the substantive originator

Walk the history list (most-recent → oldest), capped at `--max-walk=N`:

1. The first commit (most recent) is the "last-touched" commit — always reported.
2. Walk backward. Skip trivial commits.
3. The first substantive commit found is the **originating commit** — this is the "why" answer.
4. If walked all the way to the end of `--max-walk` without finding a substantive commit, surface what was found and tag confidence as `low`.

Track in output how many commits were walked.

## Phase 3: Gather surrounding context for the originator

Once the originating commit is identified, run these in parallel:

### A. Originating commit details
```
git show --no-patch --format='%H%n%an <%ae>%n%ad%n%s%n%n%b' <sha>
```

### B. Linked PR (correct attribution)

```
gh api repos/<org>/<repo>/commits/<sha>/pulls --jq '[.[] | select(.merged_at != null)] | sort_by(.merged_at) | .[0]'
```

This filters to merged PRs and picks the earliest — the actual originator, not a cherry-pick.

If no PR found (direct push to main), note: `merged directly to main, no PR`.

### C. Squash-merge detection (authoritative)

If a PR was found:
```
gh api repos/<org>/<repo>/pulls/<num> --jq '.merge_commit_sha as $mcs | {merge_method: (if .squash then "squash" elif .rebase then "rebase" else "merge" end)}'
```

If squashed, note in output that the originator's message comes from the squash commit and the individual commit history is collapsed.

### D. Review-thread comments (filtered by distance)

```
gh api repos/<org>/<repo>/pulls/<num>/comments --paginate
```

Filter: include comment only if `comment.path == target.path AND |comment.line - target.line| <= 10`. If 0 comments match within 10 lines, fall back to all comments on the same file (note in output that distance-filter found nothing).

### E. Linked ticket

Parse the originating commit's message + PR title + branch name for ticket IDs.

Use `TICKET_PREFIXES` env var if set (e.g., `TICKET_PREFIXES=CAT,COVEX,JIRA`). Otherwise fall back to a curated common list (`CAT`, `COVEX`, `JIRA`, `PROJ`, `ENG`) and warn the user once.

If a key is matched, fetch via Atlassian API using `ATLASSIAN_TOKEN` and `ATLASSIAN_USER`. If credentials missing or fetch fails, skip silently and note in output.

### F. Special-case detection

| Case | Detection | Output adjustment |
|---|---|---|
| Reverted later | `git log --grep='Revert "<originator-subject>"'` finds a result | Surface: "this code was added in <X> then reverted in <Y>" |
| Superseded by a later PR | A subsequent commit's PR body contains `supersedes #<originator-PR-num>` or `closes #<originator-PR-num>` | Surface as supersession history |
| File renamed | `git log --follow` shows a rename event prior to the target line | Show original path |
| Direct push (no PR) | Step B returned empty | Note "merged directly to main, no PR" |

## Phase 4: Confidence labeling (mechanical rules)

Tag the explanation with one of `high`, `medium`, `low`, `none`.

| Label | Criteria — must satisfy at least one |
|---|---|
| `high` | PR body or commit message contains keywords `because`, `in order to`, `to fix`, `to address`, `solves`, `resolves`. OR linked ticket has a non-empty Description field of >100 chars. |
| `medium` | Linked ticket exists with a meaningful title (>20 chars). OR review-thread (within distance 10) has ≥2 comments discussing rationale. OR commit message body (not just subject) is >100 chars. |
| `low` | Only a commit subject available. OR ticket key matched but lookup unavailable. OR walked `--max-walk` commits without finding a substantive originator. |
| `none` | Direct push, one-line subject, no ticket, no review thread. "Why" is genuinely unrecoverable from available sources. |

Only use `none` when the answer truly cannot be inferred. Don't fabricate.

## Phase 5: Output (default = quick)

```
**Why this code exists**

<One paragraph: who added it, when, in what PR, why — with confidence label>

**Walk**: Last touched in `<short-sha>` (<subject>) — classified as <substantive/trivial>.
Walked back <N> commits to find the substantive originator: `<short-sha>` (<subject>).

**Sources**
- Originating commit: `<short-sha>` — <author>, <date>
- PR: #<num> — <title> [link]  (or "no PR — direct push to main")
- Ticket: <key> — <title> [link]  (or "lookup unavailable" / "none detected")
- Review thread: <N> comments within 10 lines of target  (or "none in range; <M> elsewhere on file")
- Confidence: <high | medium | low | none>
```

Sub-commands that override Phase 5:
- `why/thorough.md` — also appends PR description excerpt, review-thread debate, secondary edits
- `why/json.md` — replaces output with structured JSON

## Phase 6: Quality gates (self-check before output)

1. The "Why" paragraph cites specific sources. No anonymous claims.
2. The walk section reports an accurate count of commits classified.
3. If the originating PR has no description body, say so — never fabricate intent.
4. Confidence label was assigned per Phase 4 mechanical rules, not by feel.
5. If any external lookup failed (`gh` not authenticated, JIRA API error), surface the gap in a `**Warnings**` section.
6. The walk did NOT silently stop early. If `--max-walk` was hit, that's surfaced.

If any gate fails, fix before output.

## Edge cases

| Case | Behavior |
|---|---|
| `gh` not authenticated | Skip PR/ticket lookups. Local git history still works. Note in warnings. |
| File has no commit history (uncommitted) | Halt: "File has no git history yet." |
| Initial repo commit | If the originating commit is the repo's initial commit, note "this is part of the initial commit; no preceding context." |
| `--max-walk` hit without finding substantive | Output the most-substantive-looking commit walked, tag confidence as `low`, note the cap was hit. |
| Multiple authors on a line range | List top 3 contributors with line counts. Pick dominant for the "why" paragraph. |
| Force-pushed history | Note in warnings that history may be incomplete. |
| `ATLASSIAN_TOKEN` missing | Skip ticket section. Note in warnings: "ticket lookup unavailable — set ATLASSIAN_TOKEN and ATLASSIAN_USER to enable." |

## Composability

- `/devkit:pr-review` uses this command's logic for "decisions inferred from history" — keep this command's output stable so pr-review can rely on the JSON shape.
- For an entire PR's history (not a single line), use `/devkit:pr-review`.

## Output personality

- Direct. The user wants the answer, not the methodology.
- The first sentence of the "Why" paragraph IS the answer. Everything after is supporting evidence.
- Source-attribute every claim.
- Surface confidence and walk count — that's how the user calibrates trust.
- Admit when context is missing. Don't fabricate.

## Guardrails

- Read-only. Never modifies files.
- DO NOT commit.
