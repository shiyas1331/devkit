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

Run the canonical pipeline from `commands/address-pr/default.md` through Phase 3 (Plan). **Halt after the plan is displayed.** Do NOT proceed to Phase 4 (Apply), Phase 5 (Commit), Phase 6 (Reply), or Phase 7 (Re-request review).

The plan output shows:
- What would be fixed (code changes)
- What would be replied to (questions / discussions)
- What would be acknowledged (nits / out-of-scope)
- Stale comments + conflicts surfaced for human decision

Phases 1-3 are unchanged from `default.md`.

## Guardrails

- DO NOT modify any files
- DO NOT post or resolve anything
- Read-only mode end-to-end
