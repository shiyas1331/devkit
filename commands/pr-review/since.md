---
description: Re-review only the diff after a given commit (second-round review after author pushed fixes). Skips the picker.
argument-hint: <PR> <commit-sha>
model: opus
---

# /devkit:pr-review:since — re-review shortcut

Equivalent to `/devkit:pr-review <PR> --since=<commit>`. Skips the picker.

Use this when the author has pushed fixes after your first review and you want to focus on what changed since then — not re-review the whole PR.

## Input

```
$ARGUMENTS
```

Expected format: `<PR> <commit-sha>` (two space-separated tokens).

If `$ARGUMENTS` is empty or has only one token, prompt for the missing piece.

## Execute

Run the standard pr-review pipeline from `commands/pr-review.md` with `since=<commit>` pre-selected. The diff scope narrows to commits after `<commit-sha>` on the PR head.

For the full pipeline, see `commands/pr-review.md`.

## Guardrails

- DO NOT post unless explicitly invoked with `--post` or `--post-review`
- DO NOT modify source files
