---
classification: mapper
file_extension: .test.ts
---

# Mapper test template (node)

For pure transform functions (`*.mapper.ts`) that convert between DTOs, GraphQL
inputs, and Mongoose models. **No mocks** — call the function directly and assert
the returned shape. These are the highest-confidence tests in the suite.

**One test file per public method.** Path:
`tests/unit/<layer-path>/<basename>.mapper/<methodName>.test.ts`

## What to cover (per method)

1. Scalar field mapping — every input field lands on the right output field.
2. Argument-injected fields (e.g. ownerId / ownerType / fabricId passed alongside input).
3. Defaults — fields the mapper fills when input omits them.
4. Enum / type coercion (status, owner type).
5. Optional / nullable handling — undefined input field → omitted vs defaulted.
6. Array mapping (`mapXs` plural variants map each element + preserve order).
7. Round-trip integrity where a paired `model→dto` / `dto→model` exists.

## Template

```ts
{{ if uses_mongoose_types }}import { Types } from 'mongoose';{{ endif }}

import { {{ mapperClass }} } from '{{ relativePathToSource }}';
{{ enum_and_type_imports }}

describe('{{ mapperClass }}.{{ methodName }}', () => {
  {{ shared_consts }}

  const make{{ Input }} = (overrides: Partial<{{ InputType }}> = {}): {{ InputType }} =>
    ({
      {{ default_input_fields }}
      ...overrides,
    } as {{ InputType }});

  it('{{ scalar_mapping_contract }}', () => {
    // Arrange
    const input = make{{ Input }}({{ overrides }});

    // Act
    const result = {{ mapperClass }}.{{ methodName }}({{ call_args }});

    // Assert
    {{ field_assertions }}
  });

  {{ for each branch / default / edge case }}
  it('{{ contract }}', () => {
    {{ body }}
  });
  {{ endfor }}
});
```

## Worked example

Source: `src/versions/v1/mappers/service/service.mapper.ts` → `mapNewServiceInputToModel`
Test:   `tests/unit/mappers/service/service.mapper/mapNewServiceInputToModel.test.ts`
(practo/content-service PR #755)

Highlights:
- No mocks. `import { Types } from 'mongoose'` for ObjectId fixtures.
- Local `makeInput(overrides)` factory returning a valid `CreateServiceNewInput`.
- Asserts scalar fields (`name`, `description`, `minCost`, `maxCost`, `iconUrl`,
  `fabricMasterId`) plus argument-injected fields (`documentOwnerFabricId`,
  `documentOwnerType`) all map correctly.
- Sibling files cover `mapServiceModelToDTO`, `mapServiceModelsToDTOs` (array),
  `mapPlainServiceObjectToDTO` — one method per file.

## Honest scope note

Mappers are pure — they almost never warrant `needs-human`. The exception is a
mapper that reaches into a DB / external client (then it's misclassified — treat
as a manager/service).
