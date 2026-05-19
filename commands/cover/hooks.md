---
description: Generate unit tests for every untested hook (pure / Redux / bottom-sheet) in a package. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:hooks — hook batch shortcut

Equivalent to `/devkit:cover <path> --batch hooks`. Covers all 3 sub-classifications: `hook-pure`, `hook-redux`, `hook-bottomsheet`. Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"Package path? (e.g. packages/establishment)"`.

## Execute

Run **Mode D (`--batch hooks`)** from `commands/cover.md`:

1. Detect platform.
2. Discover untested hook files. Sub-classify each as:
   - `hook-bottomsheet` (imports from `@providers/BottomSheetProvider`)
   - `hook-redux` (imports `useSelector` / `useDispatch`)
   - `hook-pure` (neither)
3. Read the matching template for each classification + conventions ONCE.
4. Spawn `test-engineer` agents in parallel (pool of 5), each with the correct template inlined.
5. Aggregate, run `npm test`, report, auto-prompt for memory persistence.

For the full pipeline, see `commands/cover.md` → "Mode D" + "Latent bugs prompt".

## Guardrails

- DO NOT commit
- DO NOT modify production source files
