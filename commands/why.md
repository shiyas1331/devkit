---
description: Explain why a piece of code exists — who added it, when, in which PR, with what reasoning. Pulls git blame, originating commit, linked JIRA ticket, and PR review thread into one answer.
argument-hint: <file:line> or <file> [--depth=quick|thorough] [--json]
model: opus
---

# Why does this code exist?

You answer the question every developer asks ten times a day: *"why is this here?"* Pull git blame, the originating commit, the merging PR's description, the linked ticket, and any review-thread debate into a single grounded explanation. Replace 5 minutes of manual `git blame` + GitHub clicking with a 10-second answer.

**Response format — always:**
- Start with the answer (one paragraph).
- Then drilldown sections only if the user asked `--depth=thorough`.
- Be direct. No marketing language.

## Input

Target: $ARGUMENTS

Parse for:
- `file:line` — explain that specific line (most common case)
- `file` alone — explain the file's overall existence (its first non-trivial commit)
- `file:line-range` (e.g., `apiClient.ts:120-150`) — explain that block

Optional flags:
- `--depth=quick` (default) — one-paragraph answer + sources
- `--depth=thorough` — full drilldown including subsequent edits, related PRs, review-thread highlights
- `--json` — machine-readable output for use by other commands

If `$ARGUMENTS` is empty, ask: "Which file or file:line should I explain?"

## Phase 1: Validate location

1. Check that the file exists. If not, halt: `File <path> not found.`
2. If a line number was provided, check it's in range. If not, halt: `Line <N> out of range; file has <X> lines.`
3. Detect if the file is binary or generated. If yes, note in output but continue (history may still be useful).

## Phase 2: Gather history (parallel)

Run these in parallel:

1. **Blame** for the target line(s):
   ```
   git blame -L <line>,<line> -- <file>
   ```
   Capture: commit SHA, author, date, original line content.

2. **Originating commit details**:
   ```
   git show --no-patch --format="%H%n%an <%ae>%n%ad%n%s%n%b" <sha>
   ```
   Capture: full message, author, date, parents.

3. **Linked PR** for that commit:
   ```
   gh api repos/<org>/<repo>/commits/<sha>/pulls --jq '.[0] | {number, title, body, html_url, state, mergedAt}'
   ```
   If the call fails (commit not in any PR — direct push to main), skip.

4. **PR review-thread comments** (if a PR was found):
   ```
   gh api repos/<org>/<repo>/pulls/<num>/comments --paginate --jq '.[] | {body, user:.user.login, path, line}'
   ```
   Filter to comments on the target file (and ideally near the target line).

5. **Linked ticket** (best effort):
   - Parse the PR title, branch name, and commit message for ticket IDs (`[A-Z]+-\d+`).
   - If found, attempt fetch via Atlassian API using `ATLASSIAN_TOKEN` and `ATLASSIAN_USER` env vars.
   - If credentials missing or fetch fails, skip silently and note in output.

6. **Subsequent edits** (only if `--depth=thorough`):
   ```
   git log --follow --oneline -L <line>,<line>:<file> -- <file>
   ```
   Capture every commit that touched the target line(s) after the originating one.

If a fetch fails, continue with what's available. Note unavailable sources in output.

## Phase 3: Detect special cases

Check for these and adjust output accordingly:

| Case | Detection | Adjustment |
|---|---|---|
| Line moved from another file | `git log --follow` shows a rename | Note original location |
| Squash merge | Commit message contains `(#<num>)` and PR has multiple commits | Use the squash commit's message; mention it's squashed |
| Original PR was reverted | Search recent log for `Revert "<original title>"` | Surface in output: "this code was added then reverted in commit X" |
| Code superseded by a later PR | Subsequent PR comment says "supersedes #<num>" | Mention as supersession history |
| File renamed | `git log --follow` shows a rename event | Show original path |
| Direct push to main (no PR) | Step 3's `gh api ... commits/<sha>/pulls` returns empty | Note "merged directly to main, no PR" |

## Phase 4: Output

For `--depth=quick` (default):

```
**Why this code exists**

<One paragraph: who added it, when, in what PR, why — with confidence labels>

**Sources**
- Commit: `<short-sha>` — <author>, <date>
- PR: #<num> — <title> [link]
- Ticket: <key> — <title> [link or "lookup unavailable"]
- Review thread: <N> comments [optional summary if depth=thorough]
```

For `--depth=thorough`, append:

```
**PR description excerpt**
> <first 200 chars of PR body>

**Key review-thread points**
- @<reviewer>: "<excerpt>" — outcome: <addressed / wontfix / discussion only>
- ...

**Subsequent edits** (<N> changes after the originating commit)
- `<short-sha>` — <author>, <date>: <commit subject>
- ...

**Related context**
- <e.g., "code was reverted in <sha>" or "superseded by PR #<num>" — only if detected>
```

For `--json`:

```json
{
  "file": "<path>",
  "line": <number or null>,
  "originating": {
    "sha": "<full-sha>",
    "author": "<name <email>>",
    "date": "<ISO>",
    "message": "<full message>"
  },
  "pr": { "number": <N>, "title": "<title>", "url": "<url>" } | null,
  "ticket": { "key": "<key>", "title": "<title>", "url": "<url>" } | null,
  "review_comments": [...],
  "subsequent_edits": [...],
  "special_cases": ["<reverted|superseded|moved|renamed|squashed|direct-push>"]
}
```

## Phase 5: Quality gates (self-check before output)

1. The "Why" paragraph must cite specific sources (commit / PR / ticket). No anonymous claims.
2. If the originating PR has no description body, say so — don't fabricate intent.
3. If `gh api` calls failed (no auth, network, etc.), surface the gap rather than silently degrading.
4. Confidence-tag the explanation:
   - `high`: PR description or commit message explicitly states the why
   - `medium`: ticket title + diff context align with a clear why
   - `low`: only commit subject available; "why" is inferred from context

## Edge cases

| Case | Behavior |
|---|---|
| `gh` not authenticated | Skip PR/ticket lookups. Note in output. Local git history still works. |
| File is in working tree but not committed | Halt: "File has no git history yet." |
| Initial commit of repo | Note "this is part of the initial commit; no preceding context." |
| Submodule path | Halt: "Path is in a submodule. Run inside the submodule." |
| Vendored / generated file | Note in output. History may be auto-generated commits, less useful. |
| Atlassian credentials missing | Skip ticket section. Note "ticket lookup unavailable — set ATLASSIAN_TOKEN to enable." |
| Multiple authors on the line (rare) | Show the most recent blame. Note older history in `--depth=thorough`. |

## Composability

- Used internally by `/devkit:pr-review` to infer "why" answers — this command is the single source of truth for git archaeology.
- Suggest `/devkit:explain-flow` (when available) if the user is trying to understand runtime behavior, not historical intent.
- For an entire PR's history (not a single line), use `/devkit:pr-review` instead.

## Output personality

- Direct. The user wants the answer, not the methodology.
- One paragraph for the quick path. Drilldown only on request.
- Source-attribute every claim.
- Admit when context is missing — don't fabricate.

## Example

```
/devkit:why packages/editors/src/api/apiClient.ts:188
```

Result:

```
**Why this code exists**

Added by Mohamed Shiyas on 2026-04-24 in PR #409 ("Centralize API error
mapping and skip retries for business errors") under ticket CAT-337. The
line dispatches setApiError with the curated user-facing message — part
of the broader refactor to stop leaking raw fetch errors to ErrorScreen.
Confidence: high — PR description and ticket both explicitly call out
this dispatch as the goal.

**Sources**
- Commit: `21960f9` — Mohamed Shiyas, 2026-04-24
- PR: #409 — Centralize API error mapping [link]
- Ticket: CAT-337 — API error mapper [link]
- Review thread: 8 comments
```
