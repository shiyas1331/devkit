---
description: Quick TL;DR + Triage table only (~30s read). Skips the picker.
argument-hint: <PR>
model: opus
---

# /devkit:pr-review:quick — quick brief shortcut

Equivalent to `/devkit:pr-review <PR> --depth=quick`. Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"PR? (URL, number, or branch name)"`.

## Execute

Run the standard pr-review pipeline from `commands/pr-review.md` with `depth=quick` pre-selected. Output: TL;DR + file-triage table only (no decisions, conventions, or risks sections).

For the full pipeline, see `commands/pr-review.md`.

## Guardrails

- DO NOT post to GitHub (quick mode is read-only by default)
- DO NOT modify files
