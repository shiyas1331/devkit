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

Run the standard pr-review pipeline from `commands/pr-review.md` with `post_review=true` pre-selected. Generates the brief, then for each finding with a concrete file:line reference, asks per-comment confirmation before posting as an inline review comment. Summary findings go in the review body.

For the full pipeline, see `commands/pr-review.md`.

## Guardrails

- Always confirm per inline comment (or per batch with `--bulk-confirm`)
- Always submit as `event: COMMENT` — never `REQUEST_CHANGES` or `APPROVE`
- Tag inline comments with `🤖 [devkit:pr-review]` so authors can distinguish from human comments
