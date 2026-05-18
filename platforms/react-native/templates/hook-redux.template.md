---
classification: hook-redux
file_extension: .test.tsx
---

# Redux-aware hook test template

For hooks that call `useSelector` / `useDispatch` (e.g. `useProfileType`).
Wraps `renderHook` in a `<Provider>` with a focused real store.

## What to cover

1. Initial read of state — hook returns expected slice
2. Re-render on dispatch — assert the hook value updates
3. Behaviour when the slice is in different shapes (missing fields, etc.)
4. Any computed/derived value the hook returns

## Template

```tsx
/**
 * Hook test — {{ hookName }}.
 *
 * Redux-aware hook reading state.{{ sliceName }}. Proves the useSelector
 * subscription rerenders the consumer on dispatch.
 */
import React from 'react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { renderHook, act } from '@testing-library/react-native';
import { {{ hookName }} } from '../{{ moduleName }}';
import {{ sliceName }}Reducer, { {{ actions.join(', ') }} } from '@store/{{ slicePath }}';
import { createTestStore } from '@test-utils/createTestStore';

const reducer = combineReducers({ {{ sliceName }}: {{ sliceName }}Reducer });
type TestState = ReturnType<typeof reducer>;

const makeWrapper = (store: ReturnType<typeof createTestStore<TestState>>) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };

describe('{{ hookName }}', () => {
  it('reads {{ fields_read }} from state.{{ sliceName }}', () => {
    const store = createTestStore<TestState>({
      reducer,
      preloadedState: { {{ sliceName }}: {{ preloaded_state }} as never },
    });

    const { result } = renderHook(() => {{ hookName }}(), {
      wrapper: makeWrapper(store),
    });

    {{ initial_assertions }}
  });

  it('re-renders when state changes', () => {
    const store = createTestStore<TestState>({
      reducer,
      preloadedState: { {{ sliceName }}: {{ initial_state }} as never },
    });

    const { result } = renderHook(() => {{ hookName }}(), {
      wrapper: makeWrapper(store),
    });

    act(() => {
      store.dispatch({{ action_to_dispatch }});
    });

    {{ post_dispatch_assertions }}
  });
});
```

## Worked example

Source: `useProfileType.ts`
Test: `__tests__/useProfileType.test.tsx`

```tsx
import React from 'react';
import { combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { renderHook, act } from '@testing-library/react-native';
import { useProfileType } from '../useProfileType';
import appConfigReducer, { setDoctorId } from '@store/common/slices/appConfigSlice';
import { createTestStore } from '@test-utils/createTestStore';

const reducer = combineReducers({ appConfig: appConfigReducer });
type TestState = ReturnType<typeof reducer>;

const makeWrapper = (store: ReturnType<typeof createTestStore<TestState>>) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };

describe('useProfileType', () => {
  it('re-renders when state changes', () => {
    const store = createTestStore<TestState>({
      reducer,
      preloadedState: { appConfig: { currentProfileType: 'DOCTOR' } as never },
    });

    const { result } = renderHook(() => useProfileType(), { wrapper: makeWrapper(store) });

    expect(result.current.doctorId).toBeUndefined();

    act(() => store.dispatch(setDoctorId('doc-99')));

    expect(result.current.doctorId).toBe('doc-99');
  });
});
```
