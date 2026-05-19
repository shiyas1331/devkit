---
description: Generate unit tests for every untested screen container (*Container.tsx) in a package. Skips the picker. LOW confidence — many may be marked needs-human.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:containers — container batch shortcut

Equivalent to `/devkit:cover <path> --batch containers`. Skips the picker.

⚠️ **LOW confidence per conventions.** Many containers have combinatorial JSX interactions that don't fit the template; agents may mark several as `needs-human`. Expect partial coverage and review the report carefully.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"Package path? (e.g. packages/establishment)"`.

## Execute

Run **Mode D (`--batch containers`)** from `commands/cover.md`:

1. Detect platform.
2. Discover files ending in `Container.tsx`.
3. Read container template + conventions ONCE.
4. Spawn `test-engineer` agents in parallel (pool of 5).
5. Aggregate, run `npm test`, report, auto-prompt for memory persistence.

For the full pipeline, see `commands/cover.md` → "Mode D" + "Latent bugs prompt".

## Guardrails

- DO NOT commit
- DO NOT modify production source files
