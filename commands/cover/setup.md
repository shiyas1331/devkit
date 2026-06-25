---
description: One-time scaffold of jest config, setup.ts, test-utils, and native module mocks for a fresh package. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:setup — foundation scaffolding

Equivalent to `/devkit:cover <path> --setup`. Skips the picker.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"Package path? (e.g. packages/establishment)"`.

## Context loading

Read available context BEFORE doing anything:

1. `CLAUDE.md` in the repo root (project conventions)
2. `.claude/codebase/*.md` (if exists)

## Phase 0 — Detect platform

1. List `<plugin-root>/platforms/` to enumerate available platforms.
2. For each, read `<plugin-root>/platforms/<name>/detect.md` and apply the rules.
3. Pick the first matching platform. Set `PLATFORM`, `PLATFORM_ROOT`, `HAS_JEST_CONFIG`, `HAS_MOCKS_DIR`.

If no platform matches, error and STOP.

> **If `PLATFORM==node`:** skip Phases 2–6 below (they are React-Native-specific:
> babel aliases, native-module mocks, RN test-utils). Follow the **Node setup
> track** at the end of this file instead, then resume at Phase 7 (smoke test).

## Phase 1 — Validate target

Target must be a directory with `package.json`. If not, error and STOP.

## Phase 2 — Detect existing foundation

- `HAS_JEST_CONFIG=true` if `<PLATFORM_ROOT>/jest.config.{js,ts}` exists with `preset: 'react-native'`.
- `HAS_MOCKS_DIR=true` if `<PLATFORM_ROOT>/__mocks__/` exists.
- Setup files present at `<PLATFORM_ROOT>/src/__tests__/setup.ts`, `utils/createTestStore.ts`, etc.

## Phase 3 — Build moduleNameMapper from babel.config.js

1. Read `<PLATFORM_ROOT>/babel.config.js`.
2. Extract the `alias` block under `babel-plugin-module-resolver`.
3. For each alias `@foo/*: 'path/to/foo/*'`, emit a Jest mapper line:
   ```
   '^@foo/(.*)$': '<rootDir>/path/to/foo/$1',
   ```
4. Adjust `<rootDir>` for paths that go above the package root.

## Phase 4 — Generate files

Skip any that already exist; warn the user instead of clobbering.

| File | From template | Substitutions |
|---|---|---|
| `jest.config.js` | `scaffolds/jest.config.template.js` | `{{ moduleNameMapper }}` |
| `src/__tests__/setup.ts` | `scaffolds/setup.template.ts` | `{{ apiFetchAlias }}`, `{{ storeIndexAlias }}`, `{{ providerUtilsAlias }}`, `{{ nativeNavigatorName }}` |
| `src/__tests__/utils/createTestStore.ts` | `scaffolds/createTestStore.template.ts` | (none) |
| `src/__tests__/utils/renderWithProviders.tsx` | `scaffolds/renderWithProviders.template.tsx` | `{{ rootReducerImport }}`, `{{ rootStateImport }}` |
| `src/__tests__/utils/navigationMock.ts` | `scaffolds/navigationMock.template.ts` | (none) |
| `src/__tests__/utils/index.ts` | barrel export | derived |
| `src/__tests__/fixtures/.gitkeep` | empty | (none) |

For aliases, infer from project conventions or ask the user once:
- `{{ apiFetchAlias }}` — grep for `from.*fetch` in `src/api/`; default `'@api/fetch'`.
- `{{ storeIndexAlias }}` — grep for the package's store index; default `'@store/index'`.
- `{{ providerUtilsAlias }}` — default `'@provider-utils/ErrorUtil'`; ask if not found.
- `{{ nativeNavigatorName }}` — grep `NativeModules.\w+`; default `'RNNativeNavigator'`.

## Phase 5 — Copy native module mocks

Copy from `<plugin-root>/platforms/<PLATFORM>/mocks/` to `<PLATFORM_ROOT>/__mocks__/`:

- `reanimated.mock.js` → `react-native-reanimated.js`
- `safeAreaContext.mock.tsx` → `react-native-safe-area-context.tsx`
- `selfServe.mock.tsx` → `@practo/self-serve.tsx`
- `fastImage.mock.tsx` → `react-native-fast-image.tsx`

## Phase 6 — Modify config files

**`package.json`:**
- Add devDeps if missing: `@testing-library/react-native`, `@testing-library/jest-native`.
- Add scripts if missing: `test:watch`, `test:coverage`.

**`tsconfig.json`:**
- Add `@test-utils/*` and `@fixtures/*` to `compilerOptions.paths`.

**`babel.config.js`:**
- Add the same two aliases to the `babel-plugin-module-resolver` alias block.

## Phase 7 — Smoke test

```bash
# react-native:
cd <PLATFORM_ROOT> && npm test -- --passWithNoTests 2>&1
# node:
cd <PLATFORM_ROOT> && npx jest --passWithNoTests 2>&1
```

Must exit 0. If it fails, report the error and STOP (don't write more files — let the user fix the env).

## Phase 8 — Report

```
✅ Setup complete for <PLATFORM_ROOT>

Files generated:
  • jest.config.js
  • src/__tests__/setup.ts
  • src/__tests__/utils/{createTestStore,renderWithProviders,navigationMock,index}.ts
  • __mocks__/{react-native-reanimated,react-native-safe-area-context,@practo/self-serve,react-native-fast-image}.{js,tsx}

Files modified:
  • package.json (devDeps + scripts)
  • tsconfig.json (test aliases)
  • babel.config.js (test aliases)

Smoke test passed: `npm test --passWithNoTests` → exit 0

Next: run `/devkit:cover <PLATFORM_ROOT>` to discover untested code.
```

## Guardrails

- DO NOT commit
- DO NOT modify production source files
- DO NOT skip the smoke test — if `npm test --passWithNoTests` fails, stop and report
- Idempotent: re-running won't clobber existing files

---

# Node setup track (`PLATFORM==node`)

Used instead of Phases 2–6 when the detected platform is `node`. Goal: bootstrap
ts-jest + a centralized `tests/` foundation. content-service starts from ZERO
test infra — generate everything, but never clobber existing files.

## N1 — Detect existing foundation
- `HAS_JEST_CONFIG=true` if `<PLATFORM_ROOT>/jest.config.{js,ts}` exists.
- `HAS_TS_JEST=true` if `ts-jest` is in devDependencies.
- Setup present if `<PLATFORM_ROOT>/tests/setup.ts` exists.

## N2 — Build moduleNameMapper from tsconfig paths
1. Read `<PLATFORM_ROOT>/tsconfig.json`.
2. If `compilerOptions.paths` exists, convert each `@foo/*: ['path/to/foo/*']`
   to a Jest mapper line `'^@foo/(.*)$': '<rootDir>/path/to/foo/$1'`.
3. If there are no paths, leave `{{ moduleNameMapper }}` empty — node tests use
   relative imports, so a mapper is only needed for aliases in production code.

## N3 — Generate files (skip any that exist; warn instead of clobber)

| File | From template | Substitutions |
|---|---|---|
| `jest.config.js` | `platforms/node/scaffolds/jest.config.template.js` | `{{ moduleNameMapper }}` |
| `tests/setup.ts` | `platforms/node/scaffolds/setup.template.ts` | `{{ loggerModule }}` (grep the project's logger; leave commented if unknown) |
| `tests/helpers/typedi.helper.ts` | `platforms/node/scaffolds/typedi.helper.template.ts` | (none — only if `HAS_TYPEDI`) |
| `tests/helpers/mongoose.helper.ts` | `platforms/node/scaffolds/mongoose.helper.template.ts` | (none — only if mongoose present) |

Optionally copy `platforms/node/mocks/{aws-sdk,config}.mock.ts` into
`tests/helpers/` when the project uses those boundaries.

## N4 — Modify config files
**`package.json`:**
- Add devDeps if missing: `jest`, `ts-jest`, `@types/jest`, `@types/node`.
- Add scripts if missing: `"test": "jest"`, `"test:coverage": "jest --coverage"`.

**`tsconfig.json`:** ensure `compilerOptions.types` includes `jest` and `node`
(via a `tsconfig` referenced by ts-jest, or the base tsconfig). Do NOT remove
existing options.

No babel changes (node uses ts-jest, not babel).

## N4.5 — eslint / pre-commit compatibility (CONDITIONAL — do this or the first commit fails)

Most Node services gate commits with husky → lint-staged → **type-aware eslint**
(`parserOptions.project`). Generated test files must be lint-clean or the very
first `git commit` of this foundation fails the hook. Apply the following **only
when** the repo uses typed eslint — detect by: an `.eslintrc{.js,.cjs,.json,.yml}`
exists AND its `parserOptions.project` is set. If there's no typed eslint, skip
this whole step. All sub-steps are idempotent (skip if already present).

1. **Test files not in any tsconfig project.** If the build `tsconfig.json`
   `exclude`s `**/*.test.ts` (or otherwise omits `tests/`), type-aware eslint
   errors with `Parsing error: TSConfig does not include this file`. Fix:
   - Generate `tsconfig.eslint.json` from
     `platforms/node/scaffolds/tsconfig.eslint.template.json` (extends the build
     tsconfig, adds `tests/**/*`, drops the test exclude). Align its `include`
     with the host tsconfig's includes.
   - Add an eslint `overrides` entry so test files use it:
     ```js
     {
       files: ['tests/**/*.ts'],
       parserOptions: { project: './tsconfig.eslint.json' },
     }
     ```

2. **`jest.config.js` not in any tsconfig project.** A root `.js` config trips
   typed eslint the same way. Add `jest.config.js` to the eslint `ignorePatterns`
   array (alongside whatever root `.js` configs are already listed).

3. **Exported helper return types.** The scaffolded `tests/helpers/*` already
   carry explicit return types (for `explicit-module-boundary-types`). If you
   hand-add helpers, do the same.

After applying, verify before handing off:
```bash
cd <PLATFORM_ROOT> && npx eslint 'tests/**/*.ts'   # must exit 0
```

## N5 — Resume at Phase 7 (smoke test) using the node command, then report

```
✅ Setup complete for <PLATFORM_ROOT> (node)

Files generated:
  • jest.config.js
  • tests/setup.ts
  • tests/helpers/{typedi,mongoose}.helper.ts
  • tsconfig.eslint.json            (only if repo uses typed eslint — see N4.5)

Files modified:
  • package.json (jest + ts-jest devDeps, test scripts)
  • tsconfig.json (jest/node types)
  • .eslintrc.*  (tests/** override + jest.config.js ignore — only if typed eslint)

Smoke test passed: `npx jest --passWithNoTests` → exit 0
Lint check passed:  `npx eslint 'tests/**/*.ts'` → exit 0 (if typed eslint)

Next: run `/devkit:cover <PLATFORM_ROOT>` to discover untested code, or
`/devkit:cover <PLATFORM_ROOT> --batch mappers` to start with the easy wins.
```
