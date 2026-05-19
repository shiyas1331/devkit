---
description: Full drilldown — adds PR description excerpt, key review-thread debate, and secondary edits to the basic "why" answer.
argument-hint: <file:line>
model: opus
---

# /devkit:why:thorough — thorough drilldown shortcut

Equivalent to `/devkit:why <file:line> --depth=thorough`. Skips the picker.

Use this when the quick answer isn't enough and you want the full historical context: PR description, review-thread debate, secondary commits that touched the line.

## Input

```
$ARGUMENTS
```

Expected: a target like `file:line`, `file`, or `file:start-end`.

If `$ARGUMENTS` is empty, prompt: `"Target? (e.g. apiClient.ts:188)"`.

## Execute

Run the canonical pipeline from `commands/why/default.md` (Phase 1 through Phase 4 + quality gates). At Phase 5 (Output), in addition to the standard quick output, append:

```
**PR description excerpt**
> <first 200 chars of PR body, or "(no body)">

**Key review-thread points**
- @<reviewer>: "<excerpt up to 100 chars>" — outcome: <addressed / wontfix / discussion only>
- ...

**Secondary substantive edits** (between originator and last-touched)
- `<short-sha>` — <author>, <date>: <commit subject>
- ...

**Special-case notes**
- <e.g., "this code was reverted in <sha>" or "superseded by PR #<num>" — only if detected>
```

Also extend Phase 2 (walk): list the 1–2 most recent substantive edits between the originator and the last-touched commit.

Phases 1-4 work + quality gates are unchanged from `default.md`.

## Guardrails

- Read-only — never modifies files
- Honor `TICKET_PREFIXES` env var for JIRA detection
