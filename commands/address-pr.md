---
description: Read reviewer comments on a PR, classify them, draft fixes for change-requests and replies for questions, commit and post — with author approval at every step
argument-hint: <PR url, PR number, or branch name> [--dry-run] [--ignore-bots] [--reviewer=<login>] [--auto-resolve]
model: opus
---

# Address PR Review Feedback

Author-side tool. Read open reviewer comments, classify each, draft the right response (code change or reply), apply / commit / post — with author approval at every step. Author stays in control: never apply or post without explicit confirmation.

**Response format:** one short sentence on what was done, the next concrete action, terse.

## Help mode (check first, before any other work)

If `$ARGUMENTS` is empty, or contains `--help`, `-h`, or `?` as a standalone token, print the help text below verbatim and exit immediately. Do NOT proceed to any other phase.

```
/devkit:address-pr — Walk reviewer comments and apply fixes

Usage:
  /devkit:address-pr <PR>                Walk through open reviewer comments
  /devkit:address-pr <PR> --dry-run      Show plan only; nothing applied or posted

PR identifier (any of):
  • GitHub PR URL, PR number, or branch name

Flags:
  --dry-run            Show the plan but don't apply / commit / post.
  --ignore-bots        Skip bot accounts (CodeRabbit, dependabot, danger, etc.).
  --reviewer=<login>   Only address comments from this reviewer (multi-flag supported).
  --auto-resolve       Mark threads resolved after fixes land (without asking).
  --help, -h           Show this help.

Workflow:
  1. Fetches all open review comments
  2. Classifies each (change-request / nit / question / suggestion / etc.)
  3. Shows a unified plan; asks before any action
  4. Walks each item with apply / skip / edit / push-back per fix
  5. Commits in smart batches; posts replies in one batch
  6. Optionally resolves threads and re-requests review

Examples:
  /devkit:address-pr 409
  /devkit:address-pr 409 --dry-run
  /devkit:address-pr 409 --ignore-bots --reviewer=senior-rev
```

## Input

PR identifier: $ARGUMENTS

Accept: GitHub PR URL, PR number (resolve via origin), or branch name (`gh pr list --head <branch>`).

Flags:
- `--dry-run` — show plan only; no apply / commit / post
- `--ignore-bots` — skip bot accounts (CodeRabbit, dependabot, danger, etc.)
- `--reviewer=<login>` — only address comments from this reviewer (multi-flag supported)
- `--auto-resolve` — mark threads resolved after fixes land (without asking)

(Empty `$ARGUMENTS` is handled by the Help mode section above — prints help and exits.)

## Context Loading

Read if present: `CLAUDE.md`, `.claude/codebase/*.md`, and any existing `specs/reviews/PR-<num>-*.md` from `/devkit:pr-review`. The brief informs whether comment-requested changes align with broader review concerns.

## Phase 1: Fetch comments (parallel)

1. **PR metadata** — `gh pr view <PR> --json number,title,headRefName,baseRefName,author,state,mergeStateStatus,reviewDecision`. If merged/closed, halt: "PR is <state>. Nothing to address."
2. **Review comments** — `gh api repos/<org>/<repo>/pulls/<num>/comments --paginate`. Capture `id, body, path, line, original_line, commit_id, user.login, in_reply_to_id, created_at`.
3. **General PR comments** — `gh api repos/<org>/<repo>/issues/<num>/comments --paginate`.
4. **Review summaries** — `gh api repos/<org>/<repo>/pulls/<num>/reviews --paginate`. Capture `state, body, user.login`.
5. **Resolved-thread state** (skip already-resolved):
   ```
   gh api graphql -f query='query { repository(owner:"<org>", name:"<repo>") { pullRequest(number: <num>) { reviewThreads(first:100) { nodes { id isResolved comments(first:1) { nodes { id } } } } } } }'
   ```

Filter out:
- Comments in resolved threads
- Bot comments if `--ignore-bots` (detect by `user.type=="Bot"` or login patterns: `coderabbit`, `dependabot`, `danger`, `*-bot`)
- Comments not from the requested reviewer if `--reviewer=` was provided

If nothing remains, halt: "No open review comments to address."

## Phase 2: Classify

| Type | Signals | Default action |
|---|---|---|
| `change-request` | "must", "needs to", "change this", "should be X", review state CHANGES_REQUESTED | Draft code change |
| `nit` | "nit:", "minor:", "style:", style/naming suggestions | Draft fix; batch with other nits in same file |
| `question` | "?", "why", "what if", "could you explain" | Draft reply |
| `suggestion` | "consider", "could", "what about" | Draft both — proposed change AND reply offering to discuss |
| `praise` | "nice", "lgtm", "👍" alone | No action; thank in summary |
| `out-of-scope` | "in a follow-up", "not blocking", "for later" | Reply acknowledging; do NOT resolve |

Cross-check each comment against the diff at `comment.commit_id` and `comment.path:comment.original_line`:

- **Stale** — comment's original line no longer exists or differs significantly → reply "This appears already addressed in commit <X>" and offer to resolve.
- **Conflict** — two reviewers ask for opposing changes → mark as `conflict`. Surface to author; never silently pick one.

For each comment, translate to current HEAD's `file:line` using `git diff <comment.commit_id>..HEAD -- <path>`.

## Phase 3: Plan (show before any code is touched)

```
## Address PR #<num> — <title>

<X> open comments from <Y> reviewers.

### To fix (<N> code changes)
[1] @<reviewer> at `path:line`
    "<comment body, truncated to 80 chars>"
    → Plan: <one-line description>, ~<N> lines in <file>

### To reply (<M> questions / discussions)
[1] @<reviewer> at `path:line`
    "<comment body, truncated>"
    → Plan: draft reply explaining <reasoning>

### To acknowledge (<P> nits / out-of-scope)
- <N> nits in `<file>` from @<reviewer> — batched into one commit
- <P> out-of-scope items — reply acknowledging deferral

### Stale comments (<S>)
- "<body>" → already addressed in commit <X>. Suggest resolving.

### Conflicts (<C>) — needs your decision
- @<rev1> says X, @<rev2> says Y at `path:line`. Which to take?

Proceed? (y / pick-individual / cancel)
```

If `pick-individual`, walk through each item with `apply / skip / customize`.

## Phase 4: Apply (one item at a time)

For each `change-request`, `nit`, or `suggestion`:

1. Show comment + target file:line + proposed diff.
2. Ask: `apply / skip / edit / explain / push-back`.
   - `apply` — Edit/Write the change. Run quick verification (typecheck on changed file, lint, focused tests). Surface failures; ask whether to proceed or revert.
   - `edit` — accept inline edits before applying.
   - `skip` — note as deferred.
   - `explain` — walk through the reasoning before deciding.
   - `push-back` — draft a respectful counter-argument citing code/conventions. Author edits before posting.

For each `question`:

1. Draft reply grounded in: the diff, codebase, CLAUDE.md, linked ticket.
2. Ask: `post / edit / skip`. On `post`, queue for batch posting in Phase 6.

**Smart grouping during apply:**
- 3+ nits in same file → one commit `Address review nits in <file>` after all approved
- A change-request + its mechanical test update → one commit
- Any change > 50 lines or affecting public API → individual commit with descriptive message

**Re-check after each fix:** if a fix changes a function signature or removes an export, re-classify subsequent unaddressed comments — they may be stale or invalidated.

## Phase 5: Commit

1. Show unified diff: `git diff <PR-base-commit>..<unstaged>`.
2. Show commit groupings + messages.
3. Ask: `commit / regroup / cancel`.
4. On `commit`: `git add <specific paths>` (never `-A`/`.`); commit per grouping plan; `git push`.

Commit message style: imperative, optionally `addresses #<comment-id>` for traceability. Nit batches use one-liner `Address review nits in <file>`.

## Phase 6: Reply and resolve

1. Show all queued replies, each tagged with target comment.
2. Ask: `post-all / review-individually / skip`.
3. On `post-all`: post each via:
   ```
   gh api repos/<org>/<repo>/pulls/<num>/comments/<comment-id>/replies -f body='<reply>'
   ```
4. For comments where a fix was applied:
   - If `--auto-resolve`, resolve via GraphQL; otherwise ask per comment.
   ```
   gh api graphql -f query='mutation { resolveReviewThread(input: { threadId: "<thread-id>" }) { thread { isResolved } } }'
   ```
5. For `out-of-scope` items: post the acknowledgment reply but do NOT resolve.

## Phase 7: Re-request review

1. Summarize: `<X> fixes / <Y> replies / <Z> resolved threads / <W> deferred`.
2. Ask per reviewer with open comments: `Re-request review from @<login>? (y/n)`.
3. On `y`: `gh pr review --request <login>` (or GraphQL equivalent).

Print final summary: file paths, commit hashes, counts.

## Phase 8: Quality gates

**Before showing plan (Phase 3):**
1. Every classification has explicit signals from the comment body. If unsure, ask the author.
2. No fix proposal claims to address something the comment didn't request.
3. Stale-detection actually verified the line is unchanged.
4. Conflict-detection ran across all comments, not pairwise.
5. Bot-classification uses `user.type` or known logins, not body heuristics.

**Before applying each fix:**
1. Re-read the comment to confirm intent.
2. Confirm target file:line is current.
3. Confirm the change compiles / typechecks where possible.

**Before committing:**
1. `git diff --staged` matches planned changes — no accidental edits to unrelated files.
2. No secrets / `.env` staged.

If any gate fails, fix before proceeding.

## Edge cases

| Case | Behavior |
|---|---|
| PR merged / closed | Halt. |
| No open comments | Halt. |
| Author == only commenter | Treat self-comments as low-priority deferred unless explicit change-request signals. |
| Comment contradicts CLAUDE.md / conventions | Surface with convention citation. Default to NOT applying; offer `push-back` option. |
| Reviewer changed mind in later comment | Show the most recent in thread; note earlier as superseded. |
| Force-push after local fixes | Re-fetch comment positions; some may be stale. Surface in plan. |
| `gh` not authenticated | Halt: "Run `gh auth login` and retry." |
| > 30 comments | Group by reviewer + file. Process one group at a time. |
| Comment on generated / vendored file | Warn in plan; default to skip (generated files shouldn't be hand-edited). |
| Bot comment | If `--ignore-bots`, skip. Else treat as nit/suggestion. |
| Reply posted but resolve mutation fails | Note in summary; don't roll back the reply. |

## Composability

- **`/devkit:pr-review`** — read existing brief at `specs/reviews/PR-<num>-*.md`; "Convention check" and "Risk highlights" inform whether a comment-requested change aligns with broader concerns.
- **`/devkit:why <file:line>`** — when a comment asks "why does this code exist?", use this for grounded archaeology before drafting a reply.
- **`/devkit:trace`** — suggest after a fix if runtime behavior needs verification.
- **CodeRabbit** — default to `--ignore-bots`. Without the flag, treat its comments as nits unless body says "blocker".

## Output personality

- Plan once, ask for approval, then execute step by step.
- Every action confirmable. Author can always `skip` or `cancel`.
- Summarize after each batch: `Applied 3 fixes. Posted 2 replies. Resolved 4 threads. 1 deferred.`

## Example

```
/devkit:address-pr 409
```

Fetches comments → classifies → shows plan → walks through each with confirmation → commits in groups → posts replies → optionally resolves and re-requests review.
