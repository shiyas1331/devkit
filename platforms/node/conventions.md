---
platform: node
---

# Node.js / TypeScript test conventions

These are the rules every generated test must follow. Encoded from the
content-service test foundation (practo/content-service PRs #754–768):
TypeDI managers, Mongoose repositories, pure mappers, AWS-backed services.

Test-engineer agent: load this file at the start of every run.

---

## 1. Structure — AAA, no exceptions

Every test follows Arrange / Act / Assert, with the comments inline:

```ts
it('delegates to findById with the location populate path', async () => {
  // Arrange
  const doc = { _id: doctorId, location: { city: 'c1' } };
  findByIdSpy.mockResolvedValue(doc);

  // Act
  const result = await repo.getDoctorLocationByDoctorId(doctorId, true);

  // Assert
  expect(findByIdSpy).toHaveBeenCalledWith(doctorId, true, 'location');
  expect(result).toBe(doc);
});
```

One contract per `it`. If you have ten assertions about ten behaviors, write ten
tests. Each `it(...)` description is a contract statement.

---

## 2. File placement — per-method, centralized under `tests/unit/`

**This is the biggest difference from React Native.** Node does NOT co-locate
tests in `__tests__/`. Instead:

- **One test file per PUBLIC METHOD** (not per source file).
- Centralized under `tests/unit/`, mirroring the `src/` path, with the source
  basename (minus extension) as a directory:

```
src/versions/v1/manager/transaction.manager.ts
  → tests/unit/manager/transaction.manager/executeTransaction.test.ts

src/versions/v1/repositories/doctor/doctor.addres.repository.ts
  → tests/unit/repositories/doctor/doctor.addres.repository/getDoctorLocationByDoctorId.test.ts
  → tests/unit/repositories/doctor/doctor.addres.repository/updateDoctorLocationByDoctorId.test.ts

src/versions/v1/mappers/service/service.mapper.ts
  → tests/unit/mappers/service/service.mapper/mapNewServiceInputToModel.test.ts
  → tests/unit/mappers/service/service.mapper/mapServiceModelToDTO.test.ts
```

The path under `tests/unit/` mirrors the source path **from the layer down**
(drop the `src/versions/v1/` prefix; keep the layer + sub-folders). One agent run
covers one source file and emits N test files (one per public method) — report
them all in `test_files`.

---

## 3. Imports — relative paths, not aliases

content-service tests import the unit under test with **relative paths** from the
test file back to `src/`, e.g.:

```ts
import { TransactionManager } from '../../../../src/versions/v1/manager/transaction.manager';
```

Do NOT introduce `@`-style path aliases in tests even if `tsconfig.json` defines
them — match the existing convention. Count the `../` segments from the test
file's depth under `tests/unit/` back to the repo root.

---

## 4. Mock at boundaries — never inside business logic

Mock these:

- **Mongoose**: `ClientSession` (use a `makeSession()` factory), models, and
  query builders. For repositories, prefer spying on the inherited base-class
  methods (`jest.spyOn(repo as any, 'findById')`) rather than mocking Mongoose
  end-to-end.
- **Injected dependencies**: pass mock repositories straight into a manager's
  constructor — `new XManager(mockRepo as any)`.
- **AWS SDK**: `@aws-sdk/client-s3`, `@aws-sdk/client-sqs`, `@aws-sdk/lib-storage`.
- **Module-level side-effect deps**: things imported at module top such as
  `utils/audit.context`, loggers (graylog/otel), Redis — `jest.mock(...)` them at
  the top of the file, BEFORE the import of the unit under test.
- **`config`**: capture the original flag in `beforeEach`, override per test,
  restore in `afterEach` (see §6).

Do NOT mock:

- Pure mappers (call them directly and assert the returned shape).
- Pure utils (call directly).
- The unit under test itself.

---

## 5. Test data — local factory functions

Factories are defined **locally in the test file** (content-service does NOT use a
shared `fixtures/` dir like RN). Each returns a valid default and accepts a
`Partial<>` override:

```ts
const makeSession = () => ({
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn().mockResolvedValue(undefined),
  inTransaction: jest.fn().mockReturnValue(true),
});

const makeInput = (overrides: Partial<CreateServiceNewInput> = {}): CreateServiceNewInput =>
  ({ name: 'Custom Service', type: ServiceTypesEnum.SERVICE, speciality: [], ...overrides } as CreateServiceNewInput);
```

Never inline a 20-field literal repeated across tests — make a factory.

---

## 6. TypeDI — reset the container, restore global config

content-service uses TypeDI. Tests reset the container around every test and
restore any mutated global `config` flags so tests don't bleed:

```ts
import { resetContainer } from '../../../helpers/typedi.helper';

beforeEach(() => {
  resetContainer();
  originalFlag = config.isTransactionEnabled;        // capture global config
  manager = new TransactionManager(mockRepository as any);  // inject mocks directly
});

afterEach(() => {
  (config as any).isTransactionEnabled = originalFlag;  // restore
  resetContainer();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
```

For classes constructed via `@Inject`, pass the mock dependency into the
constructor directly — do NOT go through `Container.get`.

---

## 7. Rejection assertions — `rejects.toThrow` works here

Unlike React Native's `createAsyncThunk` (which serializes errors and needs
`rejects.toMatchObject`), plain async Node methods reject with the real Error.
Use the natural matcher:

```ts
await expect(repo.getDoctorLocationByDoctorId(id, true)).rejects.toThrow();
await expect(manager.doThing()).rejects.toThrow('not found');
```

When a method is wrapped by an error-handling decorator
(`@handleManagerErrors` / `@handleRepositoryErrors`), assert that errors
**propagate** (the decorator re-throws) unless the source clearly swallows them.

---

## 8. Spying on inherited / protected methods

Repositories extend `base.repository`. To assert a method delegates to a base
method, spy on it via an `as any` cast (the method may be protected):

```ts
repo = new DoctorAddressRepository();
const findByIdSpy = jest.spyOn(repo as any, 'findById');
findByIdSpy.mockResolvedValue(doc);
```

The `as any` cast on test-only access is an accepted code smell. Do NOT cast in
production code.

---

## 9. Cleanup hooks — always

```ts
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
```

If you mutated global `config`, module singletons, or `process.env`, restore them
here too.

---

## 10. Snapshots — discouraged

No `toMatchSnapshot()`. Use explicit assertions. (Same rationale as RN: snapshots
couple tests to incidental output and are silently "fixable" by re-recording.)

---

## 11. What to cover (per public method)

For each public method, produce one `it(...)` per:

1. Happy path — assert returned value + that boundary calls were made with the
   right arguments.
2. Each branch (`if`, ternary, `&&`/`||` short-circuit, early return).
3. Each config-flag state (enabled/disabled) when behavior forks on it.
4. Edge cases — not-found → returns null / throws `/not found/`; empty input
   short-circuits; temp/short-circuit ids.
5. Error path — boundary rejects; assert propagation (or swallow, if intended).
6. Side-effect ordering when it matters (e.g. commit → endSession; abort on error).
7. Latent bug pinning (with a comment explaining the suspected bug).

---

## 12. When to mark `needs-human` / `skipped` (test-engineer agent)

Mark `needs-human` and skip a method when:

- It has > 5 distinct interacting branches (combinatorial — human picks priorities).
- It depends on a real DB transaction / aggregation / join that a unit mock can't
  faithfully represent.
- It's a thin GraphQL resolver that only wires a manager call to args (low unit
  value — better as integration).
- It has no clear public contract (re-export barrel, abstract base).

Mark `latent_bugs` (not `skipped`) when the code has a quirk worth flagging that
doesn't block test writing — write the test pinning **current** behavior, comment
the suspicion, and report it. Do NOT modify the source.

---

## 13. Latent bug surfacing

When the agent finds a code quirk:
1. Write the test that pins **current** behavior.
2. Add a comment above the test explaining the suspected bug.
3. Include `file:line` in the agent output's `latent_bugs` field with a priority.
4. Do NOT modify the source.
