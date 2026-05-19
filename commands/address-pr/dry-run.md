---
description: Show the plan only — classify comments and propose actions, but DON'T apply changes or post anything. Skips the picker.
argument-hint: <PR>
model: opus
---

# /devkit:address-pr:dry-run — preview shortcut

Equivalent to `/devkit:address-pr <PR> --dry-run`. Skips the picker.

Use this to preview what `address-pr` would do BEFORE committing to a real walk-through. Useful when you want to see "is this PR worth a full address-pr session or just a few targeted fixes?"

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"PR? (URL, number, or branch name)"`.

## Execute

Run the standard address-pr pipeline from `commands/address-pr.md` with `dry_run=true` pre-selected. Fetches and classifies comments, drafts proposed actions, but **does NOT apply code changes, commit, post replies, or resolve threads**.

For the full pipeline, see `commands/address-pr.md`.

## Guardrails

- DO NOT modify any files
- DO NOT post or resolve anything
- Read-only mode end-to-end
