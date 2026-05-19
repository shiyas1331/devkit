---
description: Save the full review brief to specs/reviews/PR-<num>-<slug>.md. Skips the picker.
argument-hint: <PR>
model: opus
---

# /devkit:pr-review:save — save-to-disk shortcut

Equivalent to `/devkit:pr-review <PR> --save`. Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"PR? (URL, number, or branch name)"`.

## Execute

Run the canonical pipeline from `commands/pr-review/default.md` (Phase 1 through Phase 4 + quality gates). At Phase 5 (Output):

1. Write the full brief to `specs/reviews/PR-<num>-<short-title-slug>.md` (or `<path>` if `--save=<path>` was given). Create the directory if missing.
2. Print: file path, TL;DR section verbatim, one-line next-step suggestion.

The Phase 1-4 work is unchanged from `default.md`.

## Guardrails

- DO NOT post to GitHub (save-only mode)
- DO NOT modify source files
