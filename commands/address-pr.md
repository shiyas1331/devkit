---
description: Read reviewer comments on a PR, classify them, draft fixes for change-requests and replies for questions, commit and post — with author approval at every step
argument-hint: <PR url, PR number, or branch name> [--dry-run] [--ignore-bots] [--reviewer=<login>] [--auto-resolve]
model: opus
---

# Address PR Review Feedback

You are tasked with helping the PR author work through reviewer comments efficiently. Read the open comments, classify each, draft the right response (code change or reply), apply or post with the author's approval, then re-request review.

This is an **author-side tool**. The reviewer does nothing — they leave normal PR comments. Your job is to remove the mechanical work of triaging comments, drafting fixes, drafting replies, and managing the resolve/re-request dance.

**Core principle: the author stays in control.** Never apply a code change or post a reply without explicit confirmation. Your job is to remove drudgery, not autonomy.

**Response format — always:**
- One short sentence describing what was just done
- The next concrete action (and what's needed from the author)
- Be terse. No marketing language.

## Input

PR identifier: $ARGUMENTS

Parse for:
- A GitHub PR URL, PR number, or branch name (same rules as `/devkit:pr-review`)

Optional flags:
- `--dry-run` — show the plan but don't apply / commit / post anything
- `--ignore-bots` — skip comments from bot accounts (CodeRabbit, dependabot, etc.) entirely
- `--reviewer=<login>` — only address comments from this reviewer (multi-flag supported)
- `--auto-resolve` — after a fix is applied successfully, mark the originating comment thread as resolved without asking

If `$ARGUMENTS` is empty, ask: "Which PR? Provide a URL, number, or branch name."

## Context Loading

Read available repo context before any drafting:
1. `CLAUDE.md` at repo root (if present)
2. `.claude/codebase/*.md` (if present)
3. Any existing `specs/reviews/PR-<num>-*.md` from `/devkit:pr-review` (if present — gives you the same brief the reviewer saw)

These define the conventions you'll honor when drafting fixes.

## Phase 1: Fetch comments

Run these in parallel:

1. **PR metadata via `gh`**:
   ```
   gh pr view <PR> --json number,title,headRefName,baseRefName,author,state,mergeStateStatus,reviewDecision
   ```
   If PR is merged or closed, halt with: "PR is <state>. Nothing to address."

2. **Review comments** (line-level, the most important):
   ```
   gh api repos/<org>/<repo>/pulls/<num>/comments --paginate
   ```
   Capture: id, body, path, line, original_line, commit_id, user.login, in_reply_to_id, created_at.

3. **General PR comments** (not tied to lines):
   ```
   gh api repos/<org>/<repo>/issues/<num>/comments --paginate
   ```

4. **Review summaries**:
   ```
   gh api repos/<org>/<repo>/pulls/<num>/reviews --paginate
   ```
   Capture: state (APPROVED / CHANGES_REQUESTED / COMMENTED), body, user.login.

5. **Resolved-thread state** (so we don't re-process resolved comments):
   ```
   gh api graphql -f query='query { repository(owner:"<org>", name:"<repo>") { pullRequest(number: <num>) { reviewThreads(first:100) { nodes { id isResolved comments(first:1) { nodes { id } } } } } } }'
   ```

Filter out:
- Comments in already-resolved threads
- Bot comments if `--ignore-bots` is set (detect by user.type=="Bot" or known bot login patterns: `coderabbit`, `dependabot`, `danger`)
- Comments not from the requested reviewer if `--reviewer=` was provided

If no remaining comments, exit with: "No open review comments to address."

## Phase 2: Classify each comment

For each remaining comment, classify into one of:

| Type | Signals | Default action |
|---|---|---|
| `change-request` | "must", "needs to", "change this", "should be X", review state CHANGES_REQUESTED | Draft code change |
| `nit` | "nit:", "minor:", "style:", style/naming suggestions | Draft fix; batch with other nits in the same file |
| `question` | "?", "why", "what if", "could you explain" | Draft reply |
| `suggestion` | "consider", "could", "what about", "we might" | Draft both — proposed change AND reply offering to discuss |
| `praise` | "nice", "lgtm", "👍" alone | No action; thank in summary |
| `out-of-scope` | "in a follow-up", "not blocking", "for later" | Note as deferred; reply acknowledging |

Cross-check the comment against the diff at `comment.commit_id` and `comment.path:comment.original_line`:

- **Stale comment** — comment's original line no longer exists or differs significantly in the latest diff → mark as `stale`. Action: draft reply "This appears already addressed in commit <X>" and offer to resolve.
- **Conflicting comments** — two reviewers ask for opposing changes on the same code → mark as `conflict`. Surface to author; do not silently pick one.

For each comment, determine the **target file:line** in the current HEAD (not the original commit) — translate using `git diff <comment.commit_id>..HEAD -- <path>` if needed.

## Phase 3: Plan

Present a unified plan to the author **before any code is touched**. Show:

```
## Address PR #<num> — <title>

<X> open comments from <Y> reviewers.

### To fix (<N> code changes)
[1] @<reviewer> at `path:line`
    "<comment body, truncated to 80 chars>"
    → Plan: <one-line description of the fix>, ~<N> lines in <file>

[2] ...

### To reply (<M> questions / discussions)
[1] @<reviewer> at `path:line`
    "<comment body, truncated>"
    → Plan: draft reply explaining <reasoning>

### To acknowledge (<P> nits / out-of-scope)
- <N> nits in `<file>` from @<reviewer> — will batch into one commit
- <P> out-of-scope items — will reply acknowledging deferral

### Stale comments (<S>)
- "<body>" → already addressed in commit <X>. Suggest resolving.

### Conflicts (<C>) — needs your decision
- @<rev1> says X, @<rev2> says Y at `path:line`. Which to take?

Proceed? (y / pick-individual / cancel)
```

Wait for response. If the author picks `pick-individual`, walk through each item and ask `apply / skip / customize` per item.

## Phase 4: Apply (one item at a time, with confirmation)

For each `change-request`, `nit`, or `suggestion` the author approved:

1. Show the comment, target file:line, and **the proposed diff**.
2. Ask: `apply / skip / edit / explain` (where `explain` walks through the reasoning).
3. On `apply`:
   - Use Edit/Write tools to apply the change.
   - Run any quick verification available (typecheck on the changed file, lint, focused tests on the changed module).
   - Surface verification failures and ask whether to proceed or revert.
4. On `edit`: open the diff in the user's editor (or accept inline edits) before applying.
5. On `skip`: note as deferred; will appear in the final summary.

For each `question`:

1. Draft a reply. Ground it in: the diff, the codebase, conventions in CLAUDE.md, and the linked ticket (if any).
2. Ask: `post / edit / skip`.
3. On `post`: queue for posting in Phase 6 (don't post yet — keep all replies for one batch).

**Smart grouping:**

- 3+ nits in the same file → batch into one commit `Address review nits in <file>` after all are individually approved.
- A change-request + its tests update → one commit if the test update is mechanical.
- Any change touching > 50 lines or affecting public API → individual commit with a descriptive message.

**Re-checking after each fix:**

If a fix changes a function signature or removes an export, re-check whether subsequent unaddressed comments are now stale or invalidated. Surface and skip those.

## Phase 5: Commit

After all approved changes are applied:

1. Show the unified diff: `git diff <PR-base-commit>..<unstaged>`.
2. Show the proposed commit groupings with messages.
3. Ask: `commit / regroup / cancel`.
4. On `commit`:
   - Create commits per the grouping plan.
   - Use `git add <specific paths>` (never `-A` or `.`).
   - Push with `git push`.

Commit message style:
- One-liner for nit batches: `Address review nits in <file>`
- Imperative + reviewer reference for substantive changes: `Add null check on doctorId — addresses @reviewer feedback`
- Include `addresses #<comment-id>` if it would be useful for traceability.

## Phase 6: Reply and resolve

After commits are pushed:

1. Show all queued replies, each tagged with their target comment.
2. Ask: `post-all / review-individually / skip`.
3. On `post-all`: post each reply via:
   ```
   gh api repos/<org>/<repo>/pulls/<num>/comments/<comment-id>/replies -f body='<reply>'
   ```
4. For comments where a fix was applied:
   - If `--auto-resolve` is set, mark the thread as resolved via the GraphQL `resolveReviewThread` mutation.
   - Otherwise ask: `Mark thread as resolved? (y/n)` per comment.

Resolve mutation:
```
gh api graphql -f query='mutation { resolveReviewThread(input: { threadId: "<thread-id>" }) { thread { isResolved } } }'
```

For `out-of-scope` items: post the acknowledgment reply but do NOT resolve — the reviewer wanted these tracked.

## Phase 7: Re-request review

After all fixes pushed and replies posted:

1. Summarize what was done: `<X> fixes / <Y> replies / <Z> resolved threads`.
2. Ask: `Re-request review from @<reviewer>? (y/n)` for each reviewer who had open comments.
3. On `y`: `gh pr review --request <login>` (or the GraphQL equivalent).

Print final summary: file paths changed, commit hashes, reply count, resolved count, any deferred items.

## Phase 8: Quality gates (self-check before any output)

Before showing the plan in Phase 3:

1. Every comment classification has explicit signals from the body. If unsure, ask the author rather than guess.
2. No fix proposal claims to address something the comment didn't actually request.
3. Stale-comment detection actually verifies the line is unchanged — don't false-positive.
4. Conflicting-comments detection runs across the whole comment set, not pairwise.
5. Bot-classification is based on user.type or known login patterns, not heuristic body matching.

Before applying each fix:

1. Re-read the comment to confirm intent.
2. Re-read the target file:line to confirm location is current.
3. Confirm the proposed change actually compiles / typechecks where possible.

Before committing:

1. Run `git diff --staged` and verify the diff matches the planned changes — no accidental edits to unrelated files.
2. Confirm no secrets or `.env` files are staged.

## Edge cases

| Case | Behavior |
|---|---|
| PR is merged / closed | Halt: "PR is <state>. Nothing to address." |
| No open comments | Halt: "No open review comments to address." |
| Author is the only commenter (self-comments) | Note in plan; treat self-comments as low-priority deferred items unless they have explicit change-request signals. |
| Comment requests a change that contradicts CLAUDE.md / conventions | Surface to author with the convention citation. Default to NOT applying — let author decide whether to push back. |
| Reviewer changed their mind in a later comment | Show the most recent comment in the thread; note the earlier ones as superseded. |
| Force-push after fixes are applied locally | Re-fetch comment positions; some may be stale. Surface in plan. |
| `gh` not authenticated | Halt: "Run `gh auth login` and try again." |
| Huge volume of comments (> 30) | Group by reviewer + file. Process one group at a time. Don't try to plan all at once. |
| Comment on a generated / vendored file | Note in plan with warning; ask author whether to apply (usually no — generated files shouldn't be hand-edited). |
| Bot comment with auto-fix suggestion | If `--ignore-bots` is set, skip. Otherwise treat as nit/suggestion. |
| Reply was posted but the resolve mutation fails | Note in summary; don't roll back the reply. |
| Author wants to disagree with a comment | Provide a `push-back` option in Phase 4: drafts a respectful counter-argument citing code/conventions. Author edits before posting. |

## Composability

- **`/devkit:pr-review`** — if a brief exists at `specs/reviews/PR-<num>-*.md`, read it. The brief's "Convention check" and "Risk highlights" sections inform whether a comment-requested change is consistent with broader concerns.
- **`/devkit:trace`** — if a fix involves a behavior question that requires runtime verification, suggest invoking `/devkit:trace` after the fix is applied.
- **CodeRabbit** — when CodeRabbit comments are bots, default to `--ignore-bots`. When run without that flag, treat their suggestions as nits unless the body explicitly says "blocker".

## Output personality

- Terse and action-oriented. No "I'll now proceed to..." narration.
- Show the plan once, ask for approval, then execute step by step.
- Every action is confirmable. The author can always say `skip` or `cancel`.
- After each batch operation, summarize: "Applied 3 fixes. Posted 2 replies. Resolved 4 threads. 1 deferred."
- Never use marketing words ("comprehensive", "powerful", "amazing").

## Example invocation

```
/devkit:address-pr 409
```

Result:
- Fetches all open comments on PR #409
- Classifies them
- Shows a plan: "5 to fix, 2 to reply, 1 stale, 0 conflicts"
- Walks through each with confirmation
- Commits in 3 logical groups
- Posts replies as a batch
- Optionally resolves threads and re-requests review

```
/devkit:address-pr 409 --dry-run
```

Result: shows the plan only. No code touched, no commits, no replies.

```
/devkit:address-pr 409 --ignore-bots --reviewer=senior-rev
```

Result: only addresses comments from `@senior-rev`, ignoring all bot-generated noise.
