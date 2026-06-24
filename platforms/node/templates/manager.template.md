---
classification: manager
file_extension: .test.ts
---

# Manager test template (node)

For TypeDI business-logic classes (`*.manager.ts`) that orchestrate injected
repositories and domain rules. Construct the manager with **mock dependencies
passed straight into the constructor**; mock at the repository / config / AWS
boundary, never inside the manager's logic.

**One test file per public method.** Path:
`tests/unit/<layer-path>/<basename>.manager/<methodName>.test.ts`

## What to cover (per method)

1. Happy path — assert the result and that injected deps were called correctly.
2. Each branch / early return / short-circuit (e.g. temp-id skip, not-found).
3. Each config-flag state when behavior forks (enabled vs disabled).
4. Edge cases — not found → `/not found/`, empty input short-circuit, falsy session.
5. Error path — dep rejects; assert propagation (decorator re-throws) or intended swallow.
6. Side-effect ordering when it matters (commit → endSession; abort-on-error).

## Template

```ts
import { config } from '{{ relativePathToConfig }}';
import { {{ managerClass }} } from '{{ relativePathToSource }}';
import { resetContainer } from '{{ relativePathToTypediHelper }}';

/**
 * {{ managerClass }}.{{ methodName }}
 *
 * {{ one-line description of the method's contract }}
 */
describe('{{ managerClass }}.{{ methodName }}', () => {
  let manager: {{ managerClass }};
  let {{ mockDepName }}: { {{ usedMethod }}: jest.Mock };
  {{ if forks_on_config }}let original{{ ConfigFlag }}: {{ flagType }};{{ endif }}

  beforeEach(() => {
    resetContainer();
    {{ if forks_on_config }}original{{ ConfigFlag }} = config.{{ configFlag }};{{ endif }}

    {{ mockDepName }} = { {{ usedMethod }}: jest.fn() };
    // Constructor takes the dependency directly (@Inject, no Container.get).
    manager = new {{ managerClass }}({{ mockDepName }} as any);
  });

  afterEach(() => {
    {{ if forks_on_config }}(config as any).{{ configFlag }} = original{{ ConfigFlag }};{{ endif }}
    resetContainer();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('{{ happy_path_contract }}', async () => {
    // Arrange
    {{ arrange_mocks }}

    // Act
    const result = await manager.{{ methodName }}({{ args }});

    // Assert
    expect(result).{{ result_matcher }};
    expect({{ mockDepName }}.{{ usedMethod }}).toHaveBeenCalledWith({{ expected_args }});
  });

  {{ for each branch / edge case }}
  it('{{ branch_contract }}', async () => {
    {{ branch_body }}
  });
  {{ endfor }}

  it('{{ error_contract }}', async () => {
    // Arrange
    {{ mockDepName }}.{{ usedMethod }}.mockRejectedValue(new Error('boom'));

    // Act + Assert
    await expect(manager.{{ methodName }}({{ args }})).rejects.toThrow('boom');
  });
});
```

## Worked example

Source: `src/versions/v1/manager/transaction.manager.ts` → `executeTransaction`
Test:   `tests/unit/manager/transaction.manager/executeTransaction.test.ts`
(practo/content-service PR #757)

Highlights from the real test:
- `makeSession()` factory for the Mongoose `ClientSession` (all lifecycle methods
  as `jest.fn()`, `inTransaction` defaults true).
- Captures `config.isTransactionEnabled` in `beforeEach`, restores in `afterEach`.
- Cases: transactions-disabled (null session, provided session ignored),
  enabled-with-provided-session (no new session, parent owns lifecycle),
  session-creation-fails fallback, happy path (start → commit → endSession order),
  abort-on-error, `inTransaction()===false` (no abort), swallowed abort/endSession
  failures.
- `s3service.manager` (same PR) shows: temp-id short-circuit, not-found →
  `/not found/` with S3 never called, POST field remapping, multi-url aggregation
  with indexed error messages.

## Honest scope note

If a method fans out across > 5 interacting branches or depends on a real DB
transaction whose semantics a mock can't capture, mark `needs-human` and let an
engineer write it.
