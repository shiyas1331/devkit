---
platform: node
---

# Classification table — node

The shared commands (`discover.md`, `file.md`, `cover.md`) read this table when
`PLATFORM==node` instead of the React Native (slice/thunk/hook) table. It maps a
source file to one of the node test templates under `platforms/node/templates/`.

## Classification table

| Signal | Classification | Template |
|---|---|---|
| filename `*.manager.ts`, a class (usually `@Service`/TypeDI) with business logic + injected repositories | `manager` | `manager.template.md` |
| filename `*.repository.ts`, a class extending `base.repository` / wrapping a Mongoose model | `repository` | `repository.template.md` |
| filename `*.mapper.ts`, a class/object of pure transform functions (DTO ↔ model) | `mapper` | `mapper.template.md` |
| under `src/services/` or filename `*.service.ts`, a class wrapping an external client (S3, Redis, OTel) | `service` | `service.template.md` |
| under `utils/` (or `*.util.ts` / `*.helper.ts`), pure functions, no DI / DB / network | `util` | `util.template.md` |
| under `workers/**`, a worker entrypoint/handler/processor (consumes a queue, runs a job) | `worker` | `worker.template.md` |
| `*.resolver.ts` (GraphQL resolver) | `resolver` | *(deferred — first release skips; mark `other`)* |
| `*.model.ts`, `*.schema.ts`, `*.types.ts`, `*.enum.ts`, `index.ts` re-exports, `*.d.ts` | `other` | (skip — no business logic) |

## Sub-classification notes

- **manager vs service**: both are classes with logic. A `manager` orchestrates
  repositories + domain rules (mock the repos). A `service` wraps a single
  external client/SDK (mock the client). Filename + directory decide: `*.manager.ts`
  → manager; `src/services/*` or `*.service.ts` → service.
- **mapper vs util**: a mapper transforms domain shapes (DTO ↔ model) and lives in
  `mappers/`; a util is generic pure logic in `utils/`. Both are tested the same way
  (no mocks, direct calls) — the distinction only picks the worked example.
- **abstract base classes** (`base.manager.ts`, `base.repository.ts`): mark
  `other` / skip — they have no concrete public API of their own; coverage comes
  through their concrete subclasses.

## Scan roots

When discovering (`discover.md`), scan both:
- `<PLATFORM_ROOT>/src/**`
- `<PLATFORM_ROOT>/workers/**`

Exclude: `tests/`, `**/__tests__/`, `*.d.ts`, `*.types.ts`, `*.enum.ts`,
`node_modules/`, `dist/`, `build/`.

## "Already tested" check (per-method aware)

Node uses **one test file per public method**, centralized under `TEST_DIR`:

```
tests/unit/<mirrored-src-path>/<basename>.<layer>/<methodName>.test.ts
```

A source file is **fully** tested only when every public method has a matching
`<methodName>.test.ts`. Partially-covered files (some methods missing) should be
reported as untested-for-the-missing-methods, not skipped wholesale.
