---
classification: hook-bottomsheet
file_extension: .test.tsx
---

# Bottom-sheet hook test template

For hooks that integrate with `BottomSheetProvider` (e.g. `useYearBottomSheet`,
`useSearchAddBottomSheet`). The hook's contract is its interaction with the
provider's setters — that's what we assert on.

## What to cover

1. Initial state — sheet is hidden (`setVisible(false)`)
2. `openSheet()` flips visibility, sets content/snap/header
3. Selection callbacks reach the latest user callback (ref pattern)
4. State machine transitions (if multi-step, e.g. search ↔ add)
5. Close handlers (`onClose`, `onDragClose`, `onBackPress`) fire correctly

## Template

```tsx
/**
 * Hook test — {{ hookName }}.
 *
 * {{ short purpose }}
 *
 * Mocks BottomSheetProvider so we can assert on setter call shapes, and
 * mocks the inner container component as a string element so we can read
 * the callback props off the React element passed to setContent.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { {{ hookName }} } from '../{{ moduleName }}';

const mockBottomSheet = {
  setVisible: jest.fn(),
  setContent: jest.fn(),
  setGenericSheetProps: jest.fn(),
  setSnapPoints: jest.fn(),
  setOnClose: jest.fn(),
  setOnDragClose: jest.fn(),
  setOnBackPress: jest.fn(),
  setBottomSheetType: jest.fn(),
  setAndroidKeyboardInputMode: jest.fn(),
  setKeyboardBlurBehavior: jest.fn(),
};

jest.mock('@providers/BottomSheetProvider', () => ({
  __esModule: true,
  useBottomSheet: () => mockBottomSheet,
}));

// Stub container as a string element type so we can read its props off the React element.
jest.mock('{{ containerPath }}', () => ({
  __esModule: true,
  {{ containerName }}: '{{ containerName }}',
}));

const getLatestPropFromContent = (propName: string) => {
  const calls = mockBottomSheet.setContent.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const element = calls[i][0];
    if (element && typeof element === 'object' && element.props?.[propName]) {
      return element.props[propName];
    }
  }
  return undefined;
};

const resetMocks = () => Object.values(mockBottomSheet).forEach(fn => fn.mockReset());

describe('{{ hookName }}', () => {
  beforeEach(resetMocks);

  it('does not open the sheet on mount', () => {
    renderHook(() => {{ hookName }}({{ initial_args }}));

    expect(mockBottomSheet.setVisible).toHaveBeenLastCalledWith(false);
    expect(mockBottomSheet.setContent).not.toHaveBeenCalled();
  });

  it('openSheet wires content, snap points, and header', () => {
    const { result } = renderHook(() => {{ hookName }}({{ initial_args }}));

    act(() => result.current.openSheet());

    expect(mockBottomSheet.setVisible).toHaveBeenLastCalledWith(true);
    expect(mockBottomSheet.setBottomSheetType).toHaveBeenCalledWith('GENERIC');
    expect(mockBottomSheet.setSnapPoints).toHaveBeenCalledWith([{{ snap_point }}]);
  });

  {{ for each selection / state-machine transition }}
  it('{{ transition_contract }}', () => {
    {{ transition_test_body }}
  });
  {{ endfor }}

  it('picks up the LATEST callback when caller re-renders with a new ref', () => {
    const first = jest.fn();
    const { result, rerender } = renderHook(
      ({ cb }: { cb: jest.Mock }) => {{ hookName }}({{ args_with_cb }}),
      { initialProps: { cb: first } },
    );
    act(() => result.current.openSheet());

    const second = jest.fn();
    rerender({ cb: second });

    const onSelect = getLatestPropFromContent('{{ callback_prop_name }}');
    act(() => onSelect!({{ callback_args }}));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({{ callback_args }});
  });
});
```

## Worked example

See `packages/editors/src/hooks/__tests__/useYearBottomSheet.test.tsx` in PR #471 for the full reference.

Key idea: the agent never tries to RENDER the bottom sheet contents — it
asserts on the SETTER CALLS that the hook makes against the provider.
