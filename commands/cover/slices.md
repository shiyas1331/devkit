---
description: Generate unit tests for every untested slice in a package. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:slices — slice batch shortcut

Equivalent to `/devkit:cover <path> --batch slices`. Skips the interactive picker for power users who already know they want the slices batch.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt the user once: `"Package path? (e.g. packages/establishment)"`.

Otherwise, treat `$ARGUMENTS` as the package path.

## Execute

Run the full **Mode D (`--batch slices`)** pipeline from `commands/cover.md`:

1. Detect platform.
2. Run discover silently. Filter inventory to untested files classified as `slice`.
3. Read the slice template + conventions ONCE.
4. Spawn `test-engineer` agents in parallel (pool of 5) with the template + conventions inlined into each prompt.
5. Aggregate JSON outputs.
6. Run `npm test` once to verify nothing broke.
7. Print the batch report (passed/needs-human/skipped + latent bugs grouped P0/P1/P2/P3).
8. **If `latent_bugs.length > 0`, auto-prompt to add to memory** via AskUserQuestion (see Latent bugs prompt in `commands/cover.md`).

For the full pipeline + memory-write format, see `commands/cover.md` → "Mode D" and "Latent bugs prompt".

## Guardrails

- DO NOT commit
- DO NOT modify production source files
- DO NOT touch files outside the target package
