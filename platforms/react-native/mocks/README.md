# React Native native module mocks

These files are copied verbatim into `<package>/__mocks__/` by
`/devkit:cover --setup`. They cover every native module that's known to
crash on import inside Jest's Node environment.

## Files

| Mock file | Real module | Strategy |
|---|---|---|
| `apiClient.mock.ts` | `@api/apiClient` | Inline jest.fn — used by test files individually |
| `errorUtil.mock.ts` | `@provider-utils/ErrorUtil` | No-op log/logError/logWarning |
| `bottomSheet.mock.ts` | `@providers/BottomSheetProvider` | Returns a bag of jest.fn setters |
| `selfServe.mock.tsx` | `@practo/self-serve` | Proxy-based generic stub — every named export becomes a View passthrough |
| `safeAreaContext.mock.tsx` | `react-native-safe-area-context` | Zero-inset passthrough |
| `reanimated.mock.js` | `react-native-reanimated` | Uses the library's official mock |
| `fastImage.mock.tsx` | `react-native-fast-image` | View passthrough |
| `gestureHandler.mock.js` | `react-native-gesture-handler` | Uses the library's jestSetup |
| `asyncStorage.mock.js` | `@react-native-async-storage/async-storage` | Uses the library's official mock |

## When to extend

If a new test crashes with `TypeError: undefined is not a function` from a
native module, copy that module's official mock (most RN libraries ship
one under `<lib>/jest/`) into this folder, then re-run `/devkit:cover --setup`.

The command tracks which mocks each package has via the `HAS_MOCKS_DIR` flag.

## Per-file copies

Each file below is a one-time copy. The agent does NOT regenerate these
per run — they're stable across packages within the react-native platform.
