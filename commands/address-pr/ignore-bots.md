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

Run the canonical pipeline from `commands/address-pr/default.md`, but at Phase 1 (Fetch comments), apply an additional filter: drop any comment where `user.type === 'Bot'` OR the login matches known patterns (`*-bot`, `coderabbitai`, `dependabot[bot]`, `danger-*`, `github-actions[bot]`).

Bot threads are NOT replied to or resolved by this mode.

Phases 2-7 are unchanged from `default.md`.

## Guardrails

- Author approval at every step (same as parent)
- DO NOT post replies to bot threads when in this mode
- DO NOT resolve bot threads automatically
