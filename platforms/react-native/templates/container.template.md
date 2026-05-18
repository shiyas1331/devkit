---
classification: container
file_extension: .test.tsx
confidence: low
---

# Container test template

> **Caveat:** container tests are the lowest-confidence category. Templates
> here cover the basic mount-and-assert pattern, but many containers will
> need human-written tests because their interactions are too varied to
> templatize.

## What to cover

1. Mount the container with `renderWithProviders` + preloaded state
2. Assert the initial UI reflects state (e.g. list count, button labels)
3. Trigger one user interaction (press, search input)
4. Assert the dispatched action or navigation call
5. Snackbar / error path (if applicable)

## Template

```tsx
/**
 * Container test — {{ containerName }}.
 *
 * {{ short purpose }}
 *
 * Tests mount the container, seed state, and assert observable UI behaviour.
 * Heavy-mocked layers below (thunks, navigation) so we test the container's
 * orchestration without crossing service boundaries.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { {{ containerName }} } from '../{{ moduleName }}';
import { renderWithProviders } from '@test-utils/renderWithProviders';
import { makeNavigation } from '@test-utils/navigationMock';
{{ if uses_fixtures }}
import { {{ fixtures.join(', ') }} } from '@fixtures/{{ fixtureModule }}';
{{ endif }}

{{ if mocks_thunks }}
jest.mock('{{ thunk_module_path }}', () => ({
  __esModule: true,
  {{ thunkName }}: Object.assign(jest.fn(() => ({ type: '{{ thunkType }}/pending' })), {
    pending: { type: '{{ thunkType }}/pending' },
    fulfilled: { type: '{{ thunkType }}/fulfilled' },
    rejected: { type: '{{ thunkType }}/rejected' },
  }),
}));
{{ endif }}

describe('{{ containerName }}', () => {
  it('renders with preloaded state', () => {
    const { getByText } = renderWithProviders(<{{ containerName }} />, {
      preloadedState: {{ preloaded_state }},
    });

    expect(getByText('{{ expected_text }}')).toBeTruthy();
  });

  {{ for each interaction }}
  it('{{ interaction_contract }}', () => {
    {{ interaction_test_body }}
  });
  {{ endfor }}
});
```

## When the agent should skip a container

- It's a screen-level navigator (mostly JSX, no logic).
- It has > 3 effectful interactions (combinatorial — write by hand).
- It uses a native module that the platform mocks don't cover.
- It depends on a `BottomSheetProvider` flow that's tested at the hook level.

The default behaviour for containers is **mark `needs-human`** unless the
container is obviously a simple list/form wrapper.

## Worked example

See `packages/editors/src/containers/common/__tests__/SnackbarContainer.test.tsx`
in PR #471 — the only container test we shipped because it's a pure
state-to-UI mapping.
