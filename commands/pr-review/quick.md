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

Run the canonical pipeline from `commands/pr-review/default.md` (Phase 1 through Phase 4 + quality gates). At Phase 5 (Output), override the full brief: print only the **TL;DR** + **Triage** table. Skip decisions / conventions / risks sections.

The Phase 1-4 work is unchanged from `default.md` — only the output stage is truncated.

## Guardrails

- DO NOT post to GitHub (quick mode is read-only by default)
- DO NOT modify files
