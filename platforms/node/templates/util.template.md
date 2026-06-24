---
classification: util
file_extension: .test.ts
---

# Util test template (node)

For pure functions in `utils/` (or `*.util.ts` / `*.helper.ts`) — no DI, no DB,
no network. Like mappers, these are high-confidence: call directly, assert
output. The value is in covering branches and edge cases exhaustively.

**One test file per exported function.** Path:
`tests/unit/<layer-path>/<basename>/<functionName>.test.ts`

## What to cover (per function)

1. Happy path for the primary shape.
2. Every branch (`if`/ternary/switch), including the `else`/default.
3. Boundary values — `0`, `''`, `[]`, `null`, `undefined`, negative, max.
4. Falsy-coercion traps (does `0` / `''` behave like the author intended?).
5. Idempotence / purity (calling twice gives the same result, no mutation of input).
6. Throwing inputs — invalid args → throws / returns sentinel per contract.

## Template

```ts
import { {{ functionName }} } from '{{ relativePathToSource }}';

describe('{{ functionName }}', () => {
  it('{{ happy_path_contract }}', () => {
    // Arrange
    const input = {{ input }};

    // Act
    const result = {{ functionName }}(input);

    // Assert
    expect(result).{{ matcher }};
  });

  {{ for each branch / boundary }}
  it('{{ contract }}', () => {
    expect({{ functionName }}({{ input }})).{{ matcher }};
  });
  {{ endfor }}

  {{ if mutates_check }}
  it('does not mutate its input', () => {
    const input = {{ input }};
    const snapshot = JSON.parse(JSON.stringify(input));
    {{ functionName }}(input);
    expect(input).toEqual(snapshot);
  });
  {{ endif }}
});
```

## Honest scope note

Pure utils rarely warrant `needs-human`. If a "util" reaches into config / a
singleton / the clock (`Date.now()`), note it as a latent concern (non-determinism)
and either inject the dependency in the test or pin current behavior with a comment.
