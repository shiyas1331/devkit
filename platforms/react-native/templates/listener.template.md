---
classification: listener
file_extension: .test.ts
---

# Redux Toolkit listener test template

For files exporting `createListenerMiddleware()` instances and registering
effects via `startListening({...})`. These react to actions dispatched
elsewhere (typically `<thunk>.fulfilled`) and dispatch follow-up actions.

## What to cover

Per listener entry (each `startListening({...})` call), produce one
`describe()` block. Inside it:

1. **Happy path** — dispatch the trigger action, assert what got dispatched
   in response.
2. **Each branch** — if the effect has `if (page === 1) ... else ...` or
   similar, one `it()` per branch.
3. **Error/catch paths** — if the effect awaits something that may reject,
   verify the error path dispatches (or doesn't dispatch) what's expected.
4. **Skipped action types** — if a listener uses `matcher: isAnyOf(...)`,
   verify each action in the matcher triggers the effect.

Don't cover:
- The action creators themselves (those are slice/thunk concerns).
- The reducer changes (the slice tests cover those).

## Mental model

```
   Slice test     →  "dispatch action, assert state changes"
   Thunk test     →  "mock API, dispatch thunk, assert payload"
   Listener test  →  "dispatch trigger action, assert WHAT GOT DISPATCHED
                      IN RESPONSE by the listener's effect"
```

The trick: install the listener's middleware into a real `configureStore`,
**append a recorder middleware** to capture every action that flows through
the chain, dispatch the trigger action, then `await` a microtask flush so
the effect runs, then assert against the recorded actions.

> ## ⚠️ Why NOT `jest.spyOn(store, 'dispatch')`
>
> **It looks right and silently fails.** Listener middleware captures the
> store's `dispatch` reference at `configureStore()` time. `jest.spyOn`
> swaps the PUBLIC property (`store.dispatch`) AFTER creation, but the
> listener already holds the original function reference — so dispatches
> from inside `effect: (action, listenerApi) => listenerApi.dispatch(...)`
> bypass the spy entirely.
>
> **Always use a recorder middleware.** It's part of the chain itself, so
> every action — including ones dispatched from inside listener effects —
> flows through it.

## Template

```ts
/**
 * Listener test — {{ listenerName }}.
 *
 * {{ short purpose — one line }}
 *
 * Pattern: install the listener middleware + a recorder middleware in a
 * focused store, dispatch the trigger action, await the effect's
 * microtask flush, then assert against the recorder. Do NOT use
 * jest.spyOn(store, 'dispatch') — the listener captures dispatch at
 * configure time, so the spy never sees its internal dispatches.
 */
import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { {{ listenerName }} } from '../{{ moduleName }}';
// Trigger action creators (what fires the effect — must be REAL, not stubbed,
// because the listener uses `actionCreator.match(action)` to decide if it fires)
import { {{ triggerThunks.join(', ') }} } from '{{ triggerModule }}';
// Response action creators (what the effect dispatches — for assertions)
import {
  {{ responseActions.join(', ') }}
} from '{{ responseModule }}';

// Mock external dependencies that the listener's effect reaches into.
{{ if uses_database }}
jest.mock('src/database/dbUtil', () => ({
  DraftEducationService: {
    getDrafts: jest.fn().mockResolvedValue([]),
    createDraft: jest.fn(),
    deleteDraft: jest.fn(),
  },
  DraftRegistrationService: {
    getDrafts: jest.fn().mockResolvedValue([]),
    createDraft: jest.fn(),
    deleteDraft: jest.fn(),
  },
}));
{{ endif }}

jest.mock('@api/apiClient', () => ({
  __esModule: true,
  apiClient: jest.fn(),
  HttpMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' },
}));

/**
 * Recorder middleware — captures every action that flows through the chain,
 * including ones dispatched from inside listener effects (which jest.spyOn
 * CANNOT intercept, because the listener middleware captured the original
 * dispatch reference at store creation time).
 *
 * `recorded` is a per-test array, reset by re-creating the store.
 */
const makeStoreAndRecorder = () => {
  const recorded: any[] = [];
  const recorderMiddleware: Middleware = () => next => action => {
    recorded.push(action);
    return next(action);
  };
  const store = configureStore({
    reducer: () => ({}),
    middleware: gDM =>
      gDM({ serializableCheck: false, immutableCheck: false })
        .prepend({{ listenerName }}.middleware)
        .concat(recorderMiddleware),
  });
  return { store, recorded };
};

/**
 * Helpers to assert against the recorder.
 */
const wasDispatched = (recorded: any[], type: string) =>
  recorded.some(a => a?.type === type);

const findDispatched = (recorded: any[], type: string) =>
  recorded.find(a => a?.type === type);

/**
 * Listener effects are async — give the microtask queue + any awaits
 * inside the effect a chance to flush before we assert. Some effects
 * chain multiple awaits; call flush() twice if assertions miss.
 */
const flush = () => new Promise(resolve => setImmediate(resolve));

describe('{{ listenerName }}', () => {
  describe('{{ triggerThunkName }}.fulfilled', () => {
    it('{{ happy_path_contract }}', async () => {
      const { store, recorded } = makeStoreAndRecorder();
      const payload = {{ trigger_payload }};

      store.dispatch({
        type: {{ triggerThunkName }}.fulfilled.type,
        payload,
        meta: { arg: {{ trigger_meta_arg }}, requestId: 'test', requestStatus: 'fulfilled' },
      });

      await flush();

      // Assert by type to keep tests resilient to payload shape changes.
      expect(wasDispatched(recorded, {{ expected_response_action_creator }}.type)).toBe(true);

      // For payload assertions, find the recorded action and inspect it.
      const recordedAction = findDispatched(recorded, {{ expected_response_action_creator }}.type);
      expect(recordedAction?.payload).toEqual({{ expected_payload }});
    });

    {{ for each branch }}
    it('{{ branch_contract }}', async () => {
      {{ branch_test_body }}
    });
    {{ endfor }}
  });

  {{ for each other trigger thunk }}
  describe('{{ triggerThunkName }}.fulfilled', () => {
    it('{{ happy_path_contract }}', async () => {
      // similar
    });
  });
  {{ endfor }}
});
```

### Two gotchas the agent should always remember

1. **Do NOT mock the trigger thunk modules.** The listener uses
   `actionCreator.match(action)` to decide if it fires. Stubbed thunks
   have `match: undefined` or a `jest.fn()` returning `undefined` (falsy),
   so the listener never fires and your tests look like the effect never
   ran. Import the REAL thunk modules; mock only the underlying API/DB
   they call into.

2. **`jest.spyOn(store, 'dispatch')` will not see listener-dispatched
   actions.** Always use the recorder middleware pattern above.

## Worked example — `educationListener` (page-1 vs page>1 branch)

Source: `src/store/doctorProfileStore/education/educationListener.ts`
Trigger: `fetchInitialEducationDetails.fulfilled` (line 31)
Effect logic:
- If `meta.arg.page === 1` → dispatch `setEducationListAPI` + `setEducationUIList`
- Else → dispatch `appendEducationListAPI` + `appendEducationUIList`
- Always → dispatch `updateVerifiedEducationsInOverview`
- Also → load drafts from SQLite, dispatch `resetAndAddDraftEducationList`

Test:

```ts
import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { educationListener } from '../educationListener';
import { fetchInitialEducationDetails } from '@api/doctorProfileApi/apiServices/DoctorProfileDetailsService';
import {
  setEducationListAPI,
  appendEducationListAPI,
  resetAndAddDraftEducationList,
} from '../educationListSlice';
import { updateVerifiedEducationsInOverview } from '../../overview/doctorOverviewSlice';

jest.mock('src/database/dbUtil', () => ({
  DraftEducationService: { getDrafts: jest.fn().mockResolvedValue([]) },
}));

jest.mock('@api/apiClient', () => ({
  __esModule: true,
  apiClient: jest.fn(),
  HttpMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' },
}));

// Recorder middleware — captures every action that flows through the chain.
// Required because jest.spyOn(store, 'dispatch') CANNOT see actions dispatched
// from inside listener effects (the listener captured dispatch at configure
// time, before the spy replaced the public property).
const makeStoreAndRecorder = () => {
  const recorded: any[] = [];
  const recorderMiddleware: Middleware = () => next => action => {
    recorded.push(action);
    return next(action);
  };
  const store = configureStore({
    reducer: () => ({}),
    middleware: gDM =>
      gDM({ serializableCheck: false, immutableCheck: false })
        .prepend(educationListener.middleware)
        .concat(recorderMiddleware),
  });
  return { store, recorded };
};

const wasDispatched = (recorded: any[], type: string) =>
  recorded.some(a => a?.type === type);

const findDispatched = (recorded: any[], type: string) =>
  recorded.find(a => a?.type === type);

const flush = () => new Promise(r => setImmediate(r));

describe('educationListener', () => {
  describe('fetchInitialEducationDetails.fulfilled', () => {
    it('SETs (not appends) on page 1', async () => {
      const { store, recorded } = makeStoreAndRecorder();
      const payload = { educationList: [{ id: 'edu-1' }] };

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload,
        meta: { arg: { page: 1, doctorId: 'doc-1' } },
      });
      await flush();

      expect(wasDispatched(recorded, setEducationListAPI.type)).toBe(true);
      expect(wasDispatched(recorded, appendEducationListAPI.type)).toBe(false);
    });

    it('APPENDs (not sets) on page > 1', async () => {
      const { store, recorded } = makeStoreAndRecorder();
      const payload = { educationList: [{ id: 'edu-2' }] };

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload,
        meta: { arg: { page: 2, doctorId: 'doc-1' } },
      });
      await flush();

      expect(wasDispatched(recorded, appendEducationListAPI.type)).toBe(true);
      expect(wasDispatched(recorded, setEducationListAPI.type)).toBe(false);
    });

    it('always dispatches updateVerifiedEducationsInOverview with SYNC actionType', async () => {
      const { store, recorded } = makeStoreAndRecorder();
      const payload = { educationList: [{ id: 'edu-1' }] };

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload,
        meta: { arg: { page: 1, doctorId: 'doc-1' } },
      });
      await flush();

      const action = findDispatched(recorded, updateVerifiedEducationsInOverview.type);
      expect(action?.payload).toEqual({
        educationAPI: payload.educationList,
        actionType: 'SYNC',
      });
    });

    it('dispatches resetAndAddDraftEducationList after loading drafts from SQLite', async () => {
      const drafts = [{ id: 'draft-1' }];
      require('src/database/dbUtil').DraftEducationService.getDrafts.mockResolvedValueOnce(drafts);

      const { store, recorded } = makeStoreAndRecorder();

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload: { educationList: [] },
        meta: { arg: { page: 1, doctorId: 'doc-1' } },
      });
      await flush();
      await flush(); // second tick — DB load + dispatch is a multi-await chain

      const action = findDispatched(recorded, resetAndAddDraftEducationList.type);
      expect(action?.payload).toEqual(drafts);
    });

    it('swallows SQLite errors silently (does NOT dispatch resetAndAddDraftEducationList on failure)', async () => {
      require('src/database/dbUtil').DraftEducationService.getDrafts.mockRejectedValueOnce(new Error('DB down'));

      const { store, recorded } = makeStoreAndRecorder();

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload: { educationList: [] },
        meta: { arg: { page: 1, doctorId: 'doc-1' } },
      });
      await flush();
      await flush();

      expect(wasDispatched(recorded, resetAndAddDraftEducationList.type)).toBe(false);
    });
  });
});
```

## Edge cases the agent should watch for

- **Async effect with multiple awaits** — `flushEffect()` may need to be called multiple times if the effect chains `await`s. Call it twice or use a more robust flush helper (`await new Promise(setImmediate); await new Promise(setImmediate);`).
- **Listener uses `matcher: isAnyOf(a, b, c)`** — one `it()` per matcher entry, not just one for the whole listener.
- **Effect that reaches `listenerApi.getState()`** — test must seed real state via the slice reducer so the selector can read.
- **Effect that uses `listenerApi.cancelActiveListeners()` or `listenerApi.fork()`** — these are advanced. If the listener uses them, mark `needs-human` rather than guess.

## Skip if

The listener has > 5 distinct branches across multiple `startListening` calls AND no clear "primary" trigger to focus on — mark `needs-human` with a prioritized list of what to test first.
