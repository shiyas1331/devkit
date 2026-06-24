# Node.js boundary mocks

Unlike React Native (which needs native-module mocks copied into `__mocks__/` to
stop import-time crashes), a Node/TypeScript service rarely crashes on import.
So these are **reusable mock helpers** test files import directly, not files
copied into a global `__mocks__/` dir.

`/devkit:cover --setup` copies the helpers that the project's stack needs into
`tests/helpers/`. The `makeSession` / `makeQuery` factories live in
`scaffolds/mongoose.helper.template.ts`; the TypeDI reset lives in
`scaffolds/typedi.helper.template.ts`.

## Files

| Mock helper | Real boundary | Strategy |
|---|---|---|
| `aws-sdk.mock.ts` | `@aws-sdk/client-s3`, `@aws-sdk/client-sqs`, `@aws-sdk/lib-storage` | `jest.mock` factory stubbing client `send` + command constructors |
| `config.mock.ts` | the project `config` singleton | capture/override/restore helper for flag-driven branches |

## When to extend

If a new test needs a boundary not listed here (Kafka, a new SDK, an HTTP
client), add a small `jest.mock` factory file here and reference it from
`conventions.md` §4 so the test-engineer agent knows to reach for it.

## Note vs React Native

Node tests use `jest.mock(<relative-module-path>, factory)` declared at the top
of each test file for module-level dependencies (e.g. `utils/audit.context`),
plus local factories for value objects. There is no platform-wide `__mocks__/`
auto-discovery requirement.
