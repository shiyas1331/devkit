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

Run the standard pr-review pipeline from `commands/pr-review.md` with `save=true` pre-selected. Writes the full brief to `specs/reviews/PR-<num>-<slug>.md` in addition to printing it.

For the full pipeline, see `commands/pr-review.md`.

## Guardrails

- DO NOT post to GitHub (save-only mode)
- DO NOT modify source files
