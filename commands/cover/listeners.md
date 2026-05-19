---
description: Generate unit tests for every untested RTK listener (createListenerMiddleware) in a package. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:listeners — listener batch shortcut

Equivalent to `/devkit:cover <path> --batch listeners`. Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"Package path? (e.g. packages/establishment)"`.

## Execute

Run **Mode D (`--batch listeners`)** from `commands/cover.md`:

1. Detect platform.
2. Discover files importing `createListenerMiddleware` OR ending in `Listener.ts(x)`.
3. Read listener template + conventions ONCE.
4. Spawn `test-engineer` agents in parallel (pool of 5).
5. Aggregate, run `npm test`, report, auto-prompt for memory persistence.

**Important — listener-specific gotchas covered by the template:**
- Use a recorder middleware (NOT `jest.spyOn(store, 'dispatch')` — the spy can't see listener-internal dispatches)
- Import REAL trigger thunks (don't stub — listener uses `actionCreator.match(action)`)

For the full pipeline + listener test patterns, see `commands/cover.md` → "Mode D" + `platforms/<PLATFORM>/templates/listener.template.md`.

## Guardrails

- DO NOT commit
- DO NOT modify production source files
