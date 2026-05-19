---
description: Address PR feedback while skipping bot accounts (CodeRabbit, dependabot, danger, etc.). Skips the picker.
argument-hint: <PR>
model: opus
---

# /devkit:address-pr:ignore-bots — human-only shortcut

Equivalent to `/devkit:address-pr <PR> --ignore-bots`. Skips the picker.

Use this when a PR has been heavily annotated by CodeRabbit / dependabot / danger / etc. and you want to focus only on human reviewer feedback first.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"PR? (URL, number, or branch name)"`.

## Execute

Run the standard address-pr pipeline from `commands/address-pr.md` with `ignore_bots=true` pre-selected. Bot-authored comments are filtered out before classification.

Bot detection: GitHub `user.type === 'Bot'`, or login matches known patterns (`*-bot`, `coderabbitai`, `dependabot[bot]`, `danger-*`, `github-actions[bot]`).

For the full pipeline, see `commands/address-pr.md`.

## Guardrails

- Author approval at every step (same as parent)
- DO NOT post replies to bot threads when in this mode
- DO NOT resolve bot threads automatically
