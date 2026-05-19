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

Run the canonical pipeline from `commands/pr-review/default.md`, but at Phase 1 (Fetch context), narrow the diff scope:
- Use `git diff <commit-sha>...HEAD` instead of `gh pr diff <PR>`.
- The PR metadata fetch is unchanged.
- Per-file history (top 10) is filtered to commits after `<commit-sha>`.

At Phase 5 (Output), append a delta section noting:
- Which commits are NEW since `<commit-sha>`.
- Whether prior brief at `specs/reviews/PR-<num>-*.md` exists. If yes, surface the diff between old and new findings.

The rest of the Phase 1-4 work is unchanged from `default.md`.

## Guardrails

- DO NOT post unless explicitly invoked with `--post` or `--post-review`
- DO NOT modify source files
