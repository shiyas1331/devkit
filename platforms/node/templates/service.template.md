---
classification: service
file_extension: .test.ts
---

# Service test template (node)

For classes that wrap a single external client/SDK — AWS S3/SQS, Redis,
OpenTelemetry, Graylog. Mock the **client** (the SDK call), not the service's own
logic. The service's job is usually: build a request, call the client, shape the
response, handle errors — test each of those.

**One test file per public method.** Path:
`tests/unit/<layer-path>/<basename>.service/<methodName>.test.ts`
(or mirror the source dir for `src/services/*` / `src/db/*`).

## What to cover (per method)

1. Happy path — client resolves; assert the request built + the shaped response.
2. Request construction branches (region/bucket/key derivation, field remapping).
3. Empty / short-circuit input (e.g. empty list → no client call).
4. Error path — client rejects; assert wrap/propagate per the service's contract.
5. Retry / fallback logic if present.

## Template

```ts
{{ if mocks_sdk_module }}
// Mock the SDK client module before importing the unit under test.
jest.mock('{{ sdkModule }}', () => ({
  {{ SdkClient }}: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  {{ sdk_command_exports }}
}));
{{ endif }}

import { {{ serviceClass }} } from '{{ relativePathToSource }}';
{{ extra_imports }}

describe('{{ serviceClass }}.{{ methodName }}', () => {
  let service: {{ serviceClass }};
  let {{ clientMethod }}Mock: jest.Mock;

  beforeEach(() => {
    {{ construct_service_and_grab_client_mock }}
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('{{ happy_path_contract }}', async () => {
    // Arrange
    {{ clientMethod }}Mock.mockResolvedValue({{ sdk_response }});

    // Act
    const result = await service.{{ methodName }}({{ args }});

    // Assert
    expect({{ clientMethod }}Mock).toHaveBeenCalledWith({{ expected_request }});
    expect(result).{{ result_matcher }};
  });

  {{ for each branch / edge case }}
  it('{{ contract }}', async () => {
    {{ body }}
  });
  {{ endfor }}

  it('{{ error_contract }}', async () => {
    {{ clientMethod }}Mock.mockRejectedValue(new Error('boom'));

    await expect(service.{{ methodName }}({{ args }})).rejects.toThrow();
  });
});
```

## Worked example

Source: `src/versions/v1/manager/s3service.manager.ts` (S3-backed; PR #757)
shows the boundary-mocking shape: presigned-URL generation, POST field remapping
(`Policy`/`X-Amz-*` → camelCase), multi-url aggregation with indexed errors, and
empty-input short-circuit (S3 never called).

For a pure infra wrapper, see `src/db/redis/service.redis.ts` /
`src/db/aws-s3/service.s3.ts` — mock the underlying client's command/`send` and
assert request shaping.

## Honest scope note

If the service couples several SDKs in one method (S3 + SQS + DB in a pipeline),
test each boundary's contribution separately or mark `needs-human`.
