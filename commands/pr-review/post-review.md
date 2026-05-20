---
description: Post a real GitHub code review with inline comments anchored to exact diff positions. Severity-labeled, deduplicated, context-aware. Skips the picker.
argument-hint: <PR>
model: opus
---

# /devkit:pr-review:post-review — native review with diff-anchored inline comments

Equivalent to `/devkit:pr-review <PR> --post-review`. Skips the picker.

⚠️ **Write action to GitHub.** Posts a single review containing inline
comments, each anchored to a real file + line in the diff via GitHub's
diff-position system. Always uses `event: COMMENT` (never REQUEST_CHANGES
or APPROVE — humans decide approval).

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"PR? (URL, number, or branch name)"`.

Supported flags:
- `--focus=<glob>` — narrow which files the reviewer agent considers
- `--since=<commit>` — limit to commits after the given SHA
- `--no-jira` — skip JIRA lookup (no effect here; kept for compat)
- `--bulk-confirm` — skip the preview, post immediately
- `--depth=<quick|thorough>` — accepted for compat but ignored here (no prose
  brief is generated; the inline comments ARE the review)

## Execute

### Phase A — Fetch PR + per-file patches + context

Use the GitHub API (NOT `gh pr diff`) so each file's structured `patch`
field is available, and so we can pull PR description + existing comments
for de-duplication.

```bash
# 1. PR metadata + state
gh api repos/<owner>/<repo>/pulls/<num> \
  --jq '{number, title, body, state, author: .user.login, head_sha: .head.sha, base_sha: .base.sha}' \
  > /tmp/pr-meta.json

# Halt if state is "merged" or "closed". Halt if `gh auth status` fails.

# 2. Per-file patches
gh api repos/<owner>/<repo>/pulls/<num>/files --paginate > /tmp/pr-files.json

# 3. Existing review comments (the anchored kind, not issue comments)
gh api repos/<owner>/<repo>/pulls/<num>/comments --paginate > /tmp/pr-review-comments.json

# 4. Existing issue-level comments (PR conversation tab)
gh api repos/<owner>/<repo>/issues/<num>/comments --paginate > /tmp/pr-issue-comments.json
```

Each `pr-files.json` entry has: `filename`, `status` (added/modified/removed/renamed),
`patch` (unified diff for the file), `additions`, `deletions`, `changes`,
`sha` (blob SHA).

**Filter the file list:**
- If `--focus=<glob>` is set, keep only matching filenames
- Always exclude generated / vendored files (these are noise targets):
  - `*.lock`, `package-lock.json`, `yarn.lock`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock`
  - `**/node_modules/**`, `**/vendor/**`, `**/Pods/**`, `**/build/**`, `**/dist/**`
  - `**/generated/**`, `**/__generated__/**`, `**/*.generated.*`
  - `*.min.js`, `*.min.css`, `*.map`
- If `--since=<commit>` is set, replace step 2 with:
  ```bash
  gh api repos/<owner>/<repo>/compare/<commit>...HEAD --jq '.files' > /tmp/pr-files.json
  ```
  (Same response shape — `filename`, `patch`, etc. Subsequent phases unchanged.)

**Filter existing comments to remove prior devkit runs** — this prevents the
agent from seeing its OWN previous output as "already raised by human
reviewers" and skipping everything on re-runs:

```bash
# Drop any comment whose body ends with the devkit tag
jq '[.[] | select(.body | test("🤖 \\[devkit:pr-review\\]$") | not)]' \
  /tmp/pr-review-comments.json > /tmp/pr-review-comments-human.json
jq '[.[] | select(.body | test("🤖 \\[devkit:pr-review\\]$") | not)]' \
  /tmp/pr-issue-comments.json > /tmp/pr-issue-comments-human.json
```

Only the `-human.json` versions are passed to the agent in Phase C.

### Phase B — Build line → diff-position map

For each file's `patch` string, build a map `new_file_line → diff_position`.

**GitHub's diff-position rules:**
- `position` is 1-indexed
- Position counts every line in the patch starting from the first `@@`
  hunk header in that file
- The `@@` header itself is position 1; the next line is position 2; and so on
- Position continues across hunks (each `@@` line counts as a position)

**Algorithm** (run via Python in Bash):

```python
def build_position_map(patch_text):
    """Returns {new_file_line: diff_position}."""
    import re
    positions = {}
    if not patch_text:
        return positions
    position = 0
    new_line = None
    for line in patch_text.split('\n'):
        position += 1
        if line.startswith('@@'):
            m = re.search(r'\+(\d+)', line)
            new_line = (int(m.group(1)) - 1) if m else None
            continue
        if new_line is None:
            continue
        if line.startswith('-'):
            # deletion — not in new file, don't advance new_line
            continue
        # ' ' (context) or '+' (addition): line exists in new file
        new_line += 1
        positions[new_line] = position
    return positions
```

Build `patchPositions = { "src/foo.ts": {42: 7, 43: 8, ...}, ... }`.

### Phase C — Generate findings via Claude (JSON-only, senior-reviewer mindset)

Call an agent with the EXACT prompt shape below. The agent must return ONLY
JSON — no markdown fences, no preface, no commentary.

**Severity data flow:** the agent emits a `severity` field in each JSON
object. The POSTING LAYER (Phase D) prefixes `[must]` or `[consider]` onto
the comment body before sending to GitHub. Don't ask the agent to embed
the prefix in `body`.

**Prompt template:**

```
You are a senior engineer reviewing a GitHub PR. Produce ONLY a JSON object
with two arrays — comments and patterns. No preface, no markdown fences,
no commentary outside the JSON.

OUTPUT SHAPE (strict):
{
  "comments": [
    {
      "path": "<exact filename from the diff>",
      "line": <integer — line number in the NEW version of the file>,
      "severity": "must" | "consider",
      "body": "<the comment text — plain markdown, 1-2 sentences max>"
    }
  ],
  "patterns": [
    {
      "issue": "<short description of the pattern>",
      "files": ["src/foo.ts", "src/bar.ts", ...]
    }
  ]
}

REVIEW STYLE — think like a senior engineer, NOT a linter:

WHAT TO COMMENT ON:
  • Logic bugs or edge cases that will actually break things
  • Security issues (unvalidated input, exposed secrets, unsafe ops)
  • Performance problems that matter at scale
  • Naming that is genuinely confusing (not stylistic preference)
  • Missing error handling where failure is realistic
  • A function doing too much — only if it's a real problem
  • Anything that will confuse the next person reading this code

WHAT NOT TO COMMENT ON:
  • Style preferences already handled by a linter
  • Trivial nits (extra blank line, minor formatting)
  • Things that are "not how I'd do it" but work fine
  • Every changed line — only comment where it genuinely matters

CONTEXT DISCIPLINE:
  • The patches below show ~3 lines of context around each change
  • If the 3-line context isn't enough to judge whether a change is
    actually wrong, SKIP rather than flag uncertainly
  • A change that looks wrong in isolation is often correct given
    surrounding code

DON'T REPEAT WHAT'S ALREADY SAID:
  • PR description below tells you what the author intended — don't
    re-raise issues they already acknowledged
  • Existing reviewer comments below show what humans already pointed
    out — never duplicate a comment that's already there

SEVERITY:
  • "must"     → actual bug, security issue, or will break something
                 (blocking — author must fix before merge)
  • "consider" → suggestion or improvement (non-blocking)
  If you're unsure between the two, use "consider".

TONE:
  • Direct but not harsh — "this will fail if X is null" not
    "you forgot null checks"
  • Suggest, don't demand — "consider extracting this into..."
  • No praise comments — if something is good, skip it
  • One clear point per comment, no bullet lists
  • Max 2 sentences

SIGNAL TO NOISE:
  • A typical PR gets 3-8 comments
  • If you have more than 10, you're being too noisy — filter down
  • If the code is clean, 0-2 is correct. An empty array is a valid
    and honest answer.

ANCHORING:
  • Every finding MUST point to a line in the NEW version of a file
    in the diff
  • Don't comment on removed lines or unchanged context
  • If a problem spans multiple lines, pick the most relevant single line

DEDUPLICATION — patterns array:
  • Before finalizing, look at your comments. Group by issue TYPE.
  • If the SAME type of issue appears in 3+ DIFFERENT files (not just
    multiple instances in one file), keep only the CLEAREST example
    as an inline comment and add the rest to `patterns`.
  • "Same type" means: same missing check, same unsafe pattern,
    same naming problem on similar variables — NOT just same category
    (e.g., "two different null checks in different contexts" = two
    separate findings, not a pattern).
  • For each pattern: list ALL files where it appears. The kept
    inline comment should NOT mention the pattern explicitly —
    that goes in the review body separately.

PR DESCRIPTION:
<paste pr-meta.json's body field. If empty, write "(none)">

EXISTING HUMAN REVIEWER COMMENTS (already raised — do not duplicate):
<paste, for each comment in pr-review-comments-human.json and
pr-issue-comments-human.json:
  - reviewer: <user.login>
  - file: <path> (if anchored)
  - body: <body>
If neither array has anything, write "(none)">

PROJECT CONVENTIONS (if any):
<paste content of CLAUDE.md, .claude/codebase/*.md, CONTRIBUTING.md, STYLE.md
from the repo root>

DIFF (per-file patches):
<paste each file's `filename`, `status`, and `patch` from /tmp/pr-files.json>

Output the JSON object now.
```

### Phase D — Post-process findings

Parse the agent's response as JSON. If it isn't valid JSON or doesn't have
both `comments` and `patterns` arrays, abort with the parse error.

**For each item in `comments`:**

1. **Validate shape:**
   - `path` is a non-empty string
   - `line` is a positive integer
   - `severity` is `"must"` or `"consider"`
   - `body` is a non-empty string
   - Drop items that fail validation

2. **Length-cap quality filter** (defense against verbose agent):
   - Drop if `body` length > 400 characters
   - Drop if `body` contains bullet lines (matches `^\s*[-*]\s` regex)
   - Drop if `body` is whitespace-only

3. **Map line to diff position:**
   - Look up `patchPositions[path]`. If path not in map, drop the finding.
   - Look up `patchPositions[path][line]`. If line not in map, drop the
     finding (line is not in the diff).

4. **Build final body** — posting layer prefixes severity + suffixes tag:
   ```
   final_body = "[" + severity + "] " + body + "\n\n🤖 [devkit:pr-review]"
   ```

5. Build the API entry: `{path, position, body: final_body}`.

**For `patterns`:**

If `patterns` is non-empty, build the review body. Otherwise body is just
the marker.

```
review_body = ""
if patterns:
    review_body += "**Patterns found across this PR:**\n\n"
    for p in patterns:
        review_body += f"- {p['issue']}: {', '.join(p['files'])}\n"
    review_body += "\nSee inline comments for the representative example of each.\n\n"
review_body += "🤖 [devkit:pr-review]"
```

**Track drop counts** by reason:
- `dropped_invalid` — bad shape
- `dropped_length_cap` — too long / has bullets
- `dropped_unmapped` — line not in diff

### Phase E — Confirmation

**Default behavior** — preview + ask once:

```
Planned review for PR #<num> — "<title>"

<N> inline comments to post
  must:      <M>
  consider:  <C>
  dropped:   <D_unmapped> unmapped, <D_invalid> invalid, <D_length> verbose

Patterns:
  <P_count> patterns found across <Sum> files

Inline comments:
  [1] [must] src/foo.ts (line 42 → pos 7)
      <first 120 chars of body>...

  [2] [consider] src/bar.tsx (line 88 → pos 19)
      <first 120 chars of body>...

  ...

Review body preview:
  <first 200 chars of review_body>

Post all <N> comments as a single GitHub review? (y / n / cancel)
```

- `y` → proceed to Phase F
- `n` / `cancel` → abort. Print: "Cancelled. No comments posted."

**With `--bulk-confirm`** — skip preview, post immediately. Print:

```
Posting <N> inline comments (<M> must, <C> consider) to PR #<num>...
```

**Soft cap warning** (both modes): if `N > 20`, print before posting:

```
⚠️ <N> comments is a lot for one review. The agent may have over-flagged.
Consider reviewing the preview before --bulk-confirm.
```

Informational only — doesn't block.

### Phase F — Post the review (atomic API + retry-after-filter)

The GitHub reviews API is atomic — if any single comment is rejected, the
WHOLE review fails. There's no per-comment skip.

Write the payload to a file (large arrays break shell escaping):

```bash
cat > /tmp/pr-review-payload.json <<EOF
{
  "body": "<review_body>",
  "event": "COMMENT",
  "comments": [
    { "path": "src/foo.ts", "position": 7, "body": "..." },
    ...
  ]
}
EOF

gh api -X POST repos/<owner>/<repo>/pulls/<num>/reviews \
  --input /tmp/pr-review-payload.json
```

**On error — retry once with offending comments removed:**

If the POST returns 422 with errors that identify SPECIFIC comments
(typically by index, or with messages like "position is invalid" /
"path does not exist in diff"):

1. Parse the GitHub error response to identify which comments failed
2. Remove those comments from the payload (track them as
   `dropped_github_rejected`)
3. Retry the POST ONCE with the filtered payload

If the retry succeeds: continue to Phase G with the dropped count noted.

If the retry also fails OR the original error isn't comment-specific
(auth issue, commit mismatch, etc.):
- Abort with the full error message
- Do NOT retry beyond one attempt
- Do NOT silently swallow unknown errors

### Phase G — Summary

After successful post:

```
✅ Posted review on PR #<num>

   <N_posted> inline comments
     must:      <M>
     consider:  <C>

   By file:
     src/foo.ts          3 comments
     src/bar.tsx         2 comments
     ...

   Patterns flagged in review body: <P_count>

   Dropped:
     <D_unmapped>  — line outside diff
     <D_invalid>   — invalid finding shape
     <D_length>    — exceeded length cap or had bullets
     <D_rejected>  — GitHub rejected after retry  (if any)

Review URL: https://github.com/<owner>/<repo>/pull/<num>#pullrequestreview-<id>
```

## Edge cases

| Case | Behavior |
|---|---|
| Agent returns `{"comments": [], "patterns": []}` | Halt: "Agent found nothing specific to flag. No review posted." |
| Agent returns non-JSON or wrong shape | Abort with parse error. No retry. |
| All findings dropped after Phase D | Halt: "All findings were filtered out (length cap, unmapped lines, or invalid shape). Nothing to post." |
| `gh` not authenticated | Halt: "Run `gh auth login` and retry." |
| PR is merged / closed | Halt with the state. |
| Soft cap (>20 comments) | Warn, still proceed. The agent was instructed for 3-8; if it produced >20 that's signal worth flagging. |
| Force-pushed during the run | Cached patch positions go stale. GitHub will reject affected comments; the retry-after-filter handles them. |
| File renamed in PR | API returns the new filename in `filename`; agent should reference that. |
| Removed file (status=removed) | New lines don't exist for removed files. Drop pre-emptively in Phase A filtering. |
| PR body is empty / no existing comments | Pass `(none)` strings to the prompt. Don't blow up. |
| Fork PR | Patch positions are relative to the base repo. Mechanism works unchanged. |

## Guardrails

- ALWAYS use `event: COMMENT` — never REQUEST_CHANGES or APPROVE
- ALWAYS confirm before posting unless `--bulk-confirm` is set
- ALWAYS suffix each comment body with `🤖 [devkit:pr-review]`
- ALWAYS prefix each body with severity (`[must]` or `[consider]`)
- ALWAYS filter prior devkit comments from the "existing reviewers" prompt
  input — otherwise re-runs see their own output as "already raised"
- NEVER post empty bodies or bodies > 400 characters
- NEVER comment on lines outside the diff — drop with logging
- NEVER chain retries beyond ONE attempt after rejection
- NEVER comment on excluded paths (lock files, generated, vendored)

## What this command does NOT do

- Does not produce the prose brief that `default` / `quick` / `save` modes
  use. The brief pipeline in `default.md` is bypassed entirely.
- Does not honor `--depth` (no brief means depth has no effect)
- Does not invoke `/devkit:why` per-finding (the agent writes self-contained
  comment bodies from the diff + PR context alone)
- Does not approve or block the PR — every review is `event: COMMENT`
- Does not deduplicate against findings from OTHER tools (CodeRabbit, etc.) —
  only against existing GitHub review/issue comments and prior devkit runs

## Composability

- Run after CodeRabbit/automated tools post first — the prior comments will
  show up as "existing reviewer comments" and dedup will skip duplicates
- Re-running on the same PR is safe — prior devkit comments are filtered out
  so the agent sees a clean state
- Pairs with `/devkit:address-pr` — author runs that after this review lands
