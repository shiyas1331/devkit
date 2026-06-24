---
classification: repository
file_extension: .test.ts
---

# Repository test template (node)

For Mongoose data-access classes (`*.repository.ts`) that extend
`base.repository`. Most public methods are thin wrappers that delegate to an
inherited base method (`findById`, `findByIdAndUpdate`, `create`, …) with a
populate path / options. The cleanest unit test **spies on the inherited base
method** and asserts the delegation, rather than mocking Mongoose end-to-end.

**One test file per public method.** Path:
`tests/unit/<layer-path>/<basename>.repository/<methodName>.test.ts`

## What to cover (per method)

1. Delegation — base method called with the exact args (id, flags, populate path).
2. Pass-through of options/flags (e.g. `cacheRefresh=true` vs `false`).
3. Not-found — base resolves `null`; method returns `null` without throwing.
4. Error propagation — base rejects; `rejects.toThrow()` (decorator re-throws).
5. Any transform the repo applies to the result before returning it.

## Template

```ts
{{ if has_module_level_deps }}
// Module-level deps must be mocked BEFORE importing the unit under test.
jest.mock('{{ relativePathToModuleDep }}', () => ({
  {{ moduleDepExports }}: jest.fn(),
}));
{{ endif }}

import { {{ repositoryClass }} } from '{{ relativePathToSource }}';
{{ extra_imports }}

describe('{{ repositoryClass }}.{{ methodName }}', () => {
  {{ scalar_test_consts }}
  let repo: {{ repositoryClass }};
  let {{ baseMethod }}Spy: jest.SpyInstance;

  beforeEach(() => {
    repo = new {{ repositoryClass }}();
    // Spy on the inherited (often protected) base method via an `as any` cast.
    {{ baseMethod }}Spy = jest.spyOn(repo as any, '{{ baseMethod }}');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // --- Happy path / pass-through ---

  it('{{ delegation_contract }}', async () => {
    // Arrange
    const doc = {{ sample_doc }};
    {{ baseMethod }}Spy.mockResolvedValue(doc);

    // Act
    const result = await repo.{{ methodName }}({{ args }});

    // Assert
    expect({{ baseMethod }}Spy).toHaveBeenCalledWith({{ expected_base_args }});
    expect(result).toBe(doc);
  });

  {{ for each flag / branch }}
  it('{{ flag_contract }}', async () => {
    {{ flag_body }}
  });
  {{ endfor }}

  // --- Edge case: not found ---

  it('returns null when {{ baseMethod }} finds nothing (no throw)', async () => {
    {{ baseMethod }}Spy.mockResolvedValue(null);

    const result = await repo.{{ methodName }}({{ args }});

    expect(result).toBeNull();
  });

  // --- Error propagation ---

  it('propagates an error raised by {{ baseMethod }}', async () => {
    {{ baseMethod }}Spy.mockRejectedValue(new Error('boom'));

    await expect(repo.{{ methodName }}({{ args }})).rejects.toThrow();
  });
});
```

## Worked example

Source: `src/versions/v1/repositories/doctor/doctor.addres.repository.ts`
Test:   `tests/unit/repositories/doctor/doctor.addres.repository/getDoctorLocationByDoctorId.test.ts`
(practo/content-service PR #759)

Highlights:
- `repo = new DoctorAddressRepository(); jest.spyOn(repo as any, 'findById')`.
- Asserts `findById` called with `(doctorId, true, 'location')` (id + cacheRefresh +
  populate path); a second test forwards `cacheRefresh=false`.
- Not-found returns `null`; base error propagates via `rejects.toThrow()`.
- A write method (`updateDoctorLocationByDoctorId`) `jest.mock`s
  `utils/audit.context` at the top, then spies on `findByIdAndUpdate`.

## Honest scope note

If a method builds a complex aggregation pipeline / multi-stage query whose
behavior can't be asserted by spying on a single base method, mark `needs-human`.
