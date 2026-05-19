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

Run the standard why pipeline from `commands/why.md` with `depth=thorough` pre-selected. Output adds:
- PR description excerpt (not just the title)
- Key review-thread points (≥2 rationale comments)
- Secondary edits (commits that touched adjacent lines)
- Confidence labels per source

For the full pipeline, see `commands/why.md`.

## Guardrails

- Read-only — never modifies files
- Honor `TICKET_PREFIXES` env var for JIRA detection
