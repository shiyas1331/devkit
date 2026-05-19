---
description: Address PR feedback and automatically mark threads resolved after fixes land — skips the per-thread "mark resolved?" prompt. Skips the picker.
argument-hint: <PR>
model: opus
---

# /devkit:address-pr:auto-resolve — auto-resolve shortcut

Equivalent to `/devkit:address-pr <PR> --auto-resolve`. Skips the picker.

Use this when you trust the resolution will be obvious for every thread in the batch and don't want to be asked "mark resolved?" for each one.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"PR? (URL, number, or branch name)"`.

## Execute

Run the standard address-pr pipeline from `commands/address-pr.md` with `auto_resolve=true` pre-selected. After each fix lands successfully, the corresponding thread is marked resolved without per-thread confirmation.

For the full pipeline, see `commands/address-pr.md`.

## Guardrails

- Author approval is STILL required for code changes / commits / posted replies — only the resolve step is automated
- DO NOT auto-resolve threads where the fix is in a different file than the one commented on (unclear correlation)
- DO NOT auto-resolve threads marked `out-of-scope` or `conflict`
