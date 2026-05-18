---
platform: react-native
---

# React Native test conventions

These are the rules every generated test must follow. Encoded from the
`provider-app/packages/editors` test foundation (PR #470) and the doctor
profile coverage work (PR #471).

Test-engineer agent: load this file at the start of every run.

---

## 1. Structure — AAA, no exceptions

Every test follows Arrange / Act / Assert:

```ts
it('describes the contract', () => {
  // ARRANGE — set up store, seed state, mock returns
  const seeded = reducer(undefined, addSomething('hello'));

  // ACT — call the unit under test
  const next = reducer(seeded, changeSomething('world'));

  // ASSERT — one focused expectation per test
  expect(next.something).toBe('world');
});
```

No tests that "set up and check ten things." If you have ten assertions, you
have ten tests. Each `it(...)` description is a contract statement.

---

## 2. File placement — co-located `__tests__/`

```
src/store/foo/
├── fooSlice.ts
├── fooListener.ts
└── __tests__/
    ├── fooSlice.test.ts
    └── __mocks__/
        └── fooData.mock.ts   ← only if shared fixtures aren't enough
```

- One test file per source file. Filename mirrors the source.
- Fixture factories live in `src/__tests__/fixtures/` and are imported via
  the `@fixtures/*` alias.
- Per-subject mock data (`__mocks__/`) only when the shared fixtures don't fit.

---

## 3. Mock at boundaries — never inside business logic

Mock these:

- Network: `@api/apiClient`, `@api/fetch`, any module wrapping `fetch()`.
- Native modules: anything from `react-native` (NativeModules, Linking, etc.)
- Provider hooks: `useBottomSheet`, navigation, etc.
- Dev loggers: `@provider-utils/ErrorUtil` (silence test output)
- External SDKs: SQLite (`getDB`), analytics, Sentry.

Do NOT mock:

- Reducers (they're pure — test them directly)
- Selectors
- Transform/utility functions (test them directly if they have logic)
- Other slices in the same package (use a real `configureStore`)

---

## 4. Test data — factory functions only

```ts
// ✅ GOOD
const edu = makeEducation({ id: 'edu-1', verificationStatus: 'VERIFIED' });

// ❌ BAD — inline literal repeated across tests
const edu = { id: 'edu-1', verificationStatus: 'VERIFIED', /* ...20 more fields... */ };
```

Factories live in `src/__tests__/fixtures/make<X>.ts`. Each exports
`makeX(overrides?: Partial<X>) => X` returning a valid default.

For API-shaped vs UI-shaped variants of the same model, name them
`makeX` and `makeApiX`.

---

## 5. Snapshots — discouraged

No `toMatchSnapshot()`. Reason: snapshots couple tests to incidental output,
making them noisy and easy to silently "fix" by re-recording. Use explicit
assertions instead.

The one exception: a small, stable structural snapshot for an output that
genuinely can't be hand-asserted (rare).

---

## 6. Stores in tests

For thunk tests, use a stub-reducer store:

```ts
const makeStore = () =>
  configureStore({
    reducer: () => ({}),
    middleware: gDM => gDM({ serializableCheck: false, immutableCheck: false }),
  });
```

For slice-state tests, call the reducer directly (no store needed):

```ts
const next = fooReducer(seeded, someAction());
```

For full integration (hook + selector + slice), use `createTestStore` from
`@test-utils/createTestStore` with a real `combineReducers` over just the
relevant slices.

---

## 7. The `as never` cast

Test-store dispatch types are narrower than production. Cast thunks at the
dispatch site:

```ts
await store.dispatch(myThunk({ doctorId: 'doc-1' }) as never).unwrap();
```

This is a deliberate code smell that's accepted in tests. Do NOT cast in
production code.

---

## 8. Thunk assertions — URL, method, body

Use the `lastCallArg()` helper pattern:

```ts
const lastCallArg = () => mockedApiClient.mock.calls[mockedApiClient.mock.calls.length - 1][0];

// then in tests:
expect(lastCallArg().url).toContain('/doctors/doc-1/registrations');
expect(lastCallArg().method).toBe('POST');
expect(lastCallArg().body).toBe(req);
```

For thunks that wrap responses in `{ data: ... }`, use a `wrap<T>()` helper:

```ts
const wrap = <T,>(payload: T) => ({ data: payload });
mockedApiClient.mockResolvedValue(wrap({ surgeryList: [] }));
```

---

## 9. Rejection assertions — use `toMatchObject`, not `toThrow`

`createAsyncThunk` serializes errors into plain objects, so `rejects.toThrow`
matchers don't work as expected. Use:

```ts
await expect(
  store.dispatch(myThunk(args) as never).unwrap(),
).rejects.toMatchObject({ message: 'Boom' });
```

---

## 10. Hook tests — `renderHook` + `act` for state changes

```ts
const { result, rerender } = renderHook(() => useThing(args), {
  wrapper: makeWrapper(store),
});

// Read initial state
expect(result.current.something).toBe('initial');

// Dispatch within act() to flush re-render
act(() => store.dispatch(setSomething('new')));
expect(result.current.something).toBe('new');
```

For hooks that build callbacks consumed by mocked components, extract the
callback from the React element passed to the mocked setter:

```ts
const getLatestOnSelect = () => {
  const calls = mockBottomSheet.setContent.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const element = calls[i][0];
    if (element?.props?.onSelect) return element.props.onSelect;
  }
};
```

This is how we test that hooks pick up the LATEST callback after rerender
(the "ref pattern" — important for stale-closure bugs).

---

## 11. Silencing test-output noise

Already handled in `setup.ts` for any package set up via `/devkit:cover --setup`:

- `@api/fetch` mocked → no module-load crashes
- `@store/index` mocked → no listener middleware boot
- `@provider-utils/ErrorUtil` mocked → no `logError` console spam
- `RNNativeNavigator` NativeModule stubbed → no native bridge crashes

Tests that intentionally trigger errors will still cause `console.error`
output unless silenced. That's fine — it confirms the error path ran.

---

## 12. When to skip writing a test (test-engineer agent)

The agent should mark a file `needs-human` and skip when:

- The source has > 5 distinct branches with non-trivial interactions
  (combinatorial explosion — human picks priorities).
- The source depends on a native module the platform mocks don't cover.
- The source is a screen/navigator with mostly JSX and no business logic
  (low value to test as a unit).
- The source has no clear public API (e.g. a file of re-exports).

Mark `latent_bugs` (not `skipped`) when the code has a quirk worth flagging
that doesn't block test writing:

- A conditional that clamps a value asymmetrically.
- A computation that uses one variable when the comment says another.
- A reducer that decrements `total` by the wrong count (we found this in
  `updateVerifiedEducationsInOverview` — see `latent-bugs.md`).

---

## 13. Latent bug surfacing

When the agent finds a code quirk:
1. Write the test that pins **current** behavior.
2. Add a comment above the test explaining the suspected bug.
3. Include the file:line in the agent output's `latent_bugs` field.
4. Do NOT modify the source.

Three real examples from CAT-494 live in
`memory/editors-latent-slice-bugs.md` (in the host repo, not devkit).
