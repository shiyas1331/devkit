---
description: One-time scaffold of jest config, setup.ts, test-utils, and native module mocks for a fresh package. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:setup — foundation scaffolding shortcut

Equivalent to `/devkit:cover <path> --setup`. Skips the interactive picker for power users who already know they want to scaffold a fresh package.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt the user once: `"Package path? (e.g. packages/establishment)"`.

Otherwise, treat `$ARGUMENTS` as the package path.

## Execute

Run the full **Mode A (`--setup`)** pipeline from `commands/cover.md`:

1. Detect platform via `platforms/<name>/detect.md` rules.
2. Detect existing foundation (jest config, mocks, setup.ts).
3. Build `moduleNameMapper` from `babel.config.js` aliases.
4. Generate scaffold files from `platforms/<PLATFORM>/scaffolds/` (skip existing).
5. Copy native module mocks from `platforms/<PLATFORM>/mocks/` to `<package>/__mocks__/`.
6. Modify `package.json` (devDeps + scripts), `tsconfig.json` (test aliases), `babel.config.js` (test aliases).
7. Run smoke test: `npm test -- --passWithNoTests` must exit 0.
8. Report files generated + next-step suggestion.

For the full step-by-step, see `commands/cover.md` → "Mode A — `--setup`".

## Guardrails (same as parent)

- DO NOT commit
- DO NOT modify production source files
- DO NOT skip the smoke test
