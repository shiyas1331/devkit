---
classification: hook-pure
file_extension: .test.ts
---

# Pure hook test template

For hooks that don't depend on Redux or other Providers (e.g. `useDebounce`,
`useInputFocusState`, `useAnimatedDots`). Just `renderHook` + assertions.

## What to cover

1. Initial return value
2. State changes on each external trigger (timer, callback, prop change)
3. Cleanup behaviour on unmount (if the hook sets up listeners/timers)

## Template

```ts
/**
 * Hook test — {{ hookName }}.
 *
 * {{ short purpose }}
 */
import { renderHook, act } from '@testing-library/react-native';
import { {{ hookName }} } from '../{{ moduleName }}';

describe('{{ hookName }}', () => {
  {{ if uses_timers }}
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  {{ endif }}

  it('{{ initial_contract }}', () => {
    const { result } = renderHook(() => {{ hookName }}({{ args }}));

    {{ initial_assertion }}
  });

  {{ for each state transition }}
  it('{{ transition_contract }}', () => {
    const { result } = renderHook(() => {{ hookName }}({{ args }}));

    act(() => {
      {{ trigger }}
    });
    {{ if uses_timers }}
    act(() => jest.advanceTimersByTime({{ ms }}));
    {{ endif }}

    {{ assertion }}
  });
  {{ endfor }}

  {{ if has_cleanup }}
  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => {{ hookName }}({{ args }}));

    unmount();

    {{ cleanup_assertion }}
  });
  {{ endif }}
});
```

## Worked example

Source: `useDebounce.ts`
Test: `__tests__/useDebounce.test.ts`

```ts
import { renderHook, act } from '@testing-library/react-native';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('first', 500));

    expect(result.current).toBe('first');
  });

  it('does NOT update before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'first' } },
    );

    rerender({ value: 'second' });
    act(() => jest.advanceTimersByTime(250));

    expect(result.current).toBe('first');
  });

  it('updates after the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'first' } },
    );

    rerender({ value: 'second' });
    act(() => jest.advanceTimersByTime(500));

    expect(result.current).toBe('second');
  });
});
```
