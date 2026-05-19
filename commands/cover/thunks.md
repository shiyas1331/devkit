---
description: Generate unit tests for every untested thunk (createAsyncThunk) in a package. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:thunks — thunk batch shortcut

Equivalent to `/devkit:cover <path> --batch thunks`. Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"Package path? (e.g. packages/establishment)"`.

## Execute

Run **Mode D (`--batch thunks`)** from `commands/cover.md`:

1. Detect platform.
2. Discover untested thunks (files exporting `createAsyncThunk`).
3. Read thunk template + conventions ONCE.
4. Spawn `test-engineer` agents in parallel (pool of 5).
5. Aggregate, run `npm test`, report, auto-prompt for memory persistence.

For the full pipeline, see `commands/cover.md` → "Mode D" + "Latent bugs prompt".

## Guardrails

- DO NOT commit
- DO NOT modify production source files
