---
classification: worker
file_extension: .test.ts
---

# Worker test template (node)

For code under `workers/**` — message processors, job handlers, and worker-internal
repositories/services. Workers have their own mini-layering (e.g.
`media-worker/processors/`, `media-worker/repositories/`). The testable unit is
usually a **processor class** (a `process()` method) or a **handler object** (a
map of methods) that consumes one message/job and calls internal services/repos.

Mock the queue client (SQS/Kafka) and the worker's injected
services/repositories; test the processing logic in between.

**One test file per public method.** Path mirrors the worker source under
`tests/unit/workers/<...>/<basename>/<methodName>.test.ts`.

## What to cover (per method)

1. Happy path — valid message → correct service/repo calls → expected result/ack.
2. Message-shape branches (type routing in a processor factory, mimeType checks).
3. Idempotency / dedup (already-processed message is skipped).
4. Validation failures — malformed message → rejected / dead-lettered, not crash.
5. Downstream error — service rejects; assert retry / nack / propagate per contract.
6. Side effects ordering (download → transform → upload → mark-done).

## Template

```ts
{{ if mocks_module_deps }}
jest.mock('{{ relativePathToServiceOrRepo }}', () => ({
  {{ depExports }}: jest.fn(),
}));
{{ endif }}

import { {{ workerUnit }} } from '{{ relativePathToSource }}';
{{ extra_imports }}

describe('{{ workerUnit }}.{{ methodName }}', () => {
  let {{ unitInstance }}: {{ workerUnitType }};
  let {{ mockDep }}: { {{ usedMethod }}: jest.Mock };

  const makeMessage = (overrides: Partial<{{ MessageType }}> = {}): {{ MessageType }} =>
    ({ {{ default_message_fields }}, ...overrides } as {{ MessageType }});

  beforeEach(() => {
    {{ mockDep }} = { {{ usedMethod }}: jest.fn() };
    {{ unitInstance }} = new {{ workerUnitType }}({{ mockDep }} as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('{{ happy_path_contract }}', async () => {
    // Arrange
    const message = makeMessage();
    {{ arrange_mocks }}

    // Act
    const result = await {{ unitInstance }}.{{ methodName }}(message);

    // Assert
    expect({{ mockDep }}.{{ usedMethod }}).toHaveBeenCalledWith({{ expected_args }});
    expect(result).{{ result_matcher }};
  });

  {{ for each branch / edge case }}
  it('{{ contract }}', async () => {
    {{ body }}
  });
  {{ endfor }}

  it('{{ error_contract }}', async () => {
    {{ mockDep }}.{{ usedMethod }}.mockRejectedValue(new Error('boom'));

    await expect({{ unitInstance }}.{{ methodName }}(makeMessage())).rejects.toThrow();
  });
});
```

## Worked example

content-service `workers/media-worker/processors/` is the canonical shape:
`base.processor.ts` (abstract — skip), `image.processor.ts` / `video.processor.ts`
/ `pdf.processor.ts` (concrete `process()` methods — test these), and
`processor.factory.ts` (type → processor routing — test the branch table).

For a handler-object worker, see `workers/migration/executor/establishment.handler.ts`
(`export const establishmentHandler: EntityHandler = { ... }`) — test each method
on the object with mocked dependencies.

## Honest scope note

Worker `index.ts` entrypoints (poll loop + wiring) are integration-shaped — mark
`needs-human` / skip and test the processors/handlers they call instead.
Abstract base processors have no concrete contract — skip.
