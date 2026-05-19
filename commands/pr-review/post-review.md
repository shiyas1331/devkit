---
description: Post a full GitHub code review with inline comments at relevant file:lines plus a summary body. Confirms each inline comment. Skips the picker.
argument-hint: <PR>
model: opus
---

# /devkit:pr-review:post-review — native review shortcut

Equivalent to `/devkit:pr-review <PR> --post-review`. Skips the picker.

⚠️ This is a **write action to GitHub.** Posts inline comments at file:line locations plus a summary body. The command confirms each inline comment individually before posting (use `--bulk-confirm` via the main command for one batch confirmation).

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"PR? (URL, number, or branch name)"`.

## Execute

Run the canonical pipeline from `commands/pr-review/default.md` (Phase 1 through Phase 4 + quality gates). At Phase 5 (Output), instead of printing the brief:

1. **Build the review payload** by mapping brief sections:

   | Brief section | Becomes |
   |---|---|
   | TL;DR + Risk + Triage + Decisions inferred + Suggested verification | Review summary `body` |
   | Each Convention deviation with file:line | Inline comment at that file:line |
   | Each Risk highlight with file:line | Inline comment at that file:line |
   | Each Open question with file:line | Inline comment at that file:line |

   Skip any finding without a concrete file:line — those stay in the summary only.

2. **Tag every inline comment** with a visible marker. Prefix each comment body with: `🤖 [devkit:pr-review]\n\n`

3. **Validate every file:line** against the latest commit's diff before queuing. Drop comments whose line doesn't exist in the latest commit (stale lines). Note dropped count in the confirmation prompt.

4. **Cap inline comments per file** at 5 by default. Excess findings on the same file go into the summary body as `**Additional notes on <file>**`.

5. **Confirm before posting:**
   - Default: per-comment. Show each as `[N/M] <file:line>: <body>` and ask `(y / n / edit / cancel-review)`. `cancel-review` aborts the whole post.
   - With `--bulk-confirm`: show all inline comments + the summary body, ask one `(y / n)`.

6. **Submit as a single review** via:
   ```
   gh api repos/<org>/<repo>/pulls/<num>/reviews \
       -f event=COMMENT \
       -F body='<summary>' \
       -F 'comments[]={"path":"<path>","line":<N>,"body":"<text>"}' \
       -F 'comments[]={...}'
   ```
   Always `event: COMMENT`. Never `REQUEST_CHANGES` or `APPROVE` — let humans block or approve.

7. **Print a summary** of what was posted: `Posted review with <N> inline comments + summary. <M> findings stayed in summary only. <D> dropped (stale lines).`

**Edge cases:**
- If no inline-eligible findings exist, halt with: `"No inline-eligible findings; use --post instead for a summary comment."`
- If > 20 inline comments would be posted, warn: `"This review would post <N> inline comments. Bulk-confirm? (y/n/cancel)"`. Never silently post a large batch.

The Phase 1-4 work is unchanged from `default.md`.

## Guardrails

- Always confirm per inline comment (or per batch with `--bulk-confirm`)
- Always submit as `event: COMMENT` — never `REQUEST_CHANGES` or `APPROVE`
- Tag inline comments with `🤖 [devkit:pr-review]` so authors can distinguish from human comments
