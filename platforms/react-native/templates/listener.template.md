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
spy on `store.dispatch`, dispatch the trigger action, then `await` a
microtask flush so the effect runs, then assert on the spy.

## Template

```ts
/**
 * Listener test — {{ listenerName }}.
 *
 * {{ short purpose — one line }}
 *
 * Pattern: install the listener middleware in a focused store, dispatch
 * the trigger action, await the effect's microtask flush, assert what
 * got dispatched in response.
 */
import { configureStore } from '@reduxjs/toolkit';
import { {{ listenerName }} } from '../{{ moduleName }}';
// Trigger action creators (what fires the effect)
import { {{ triggerThunks.join(', ') }} } from '{{ triggerModule }}';
// Response action creators (what the effect dispatches — to assert with)
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

const makeStore = () =>
  configureStore({
    reducer: () => ({}),
    middleware: gDM =>
      gDM({ serializableCheck: false, immutableCheck: false })
        .prepend({{ listenerName }}.middleware),
  });

/**
 * Listener effects are async — give the microtask queue + any awaits
 * inside the effect a chance to flush before we assert.
 */
const flushEffect = () => new Promise(resolve => setImmediate(resolve));

describe('{{ listenerName }}', () => {
  describe('{{ triggerThunkName }}.fulfilled', () => {
    it('{{ happy_path_contract }}', async () => {
      const store = makeStore();
      const dispatchSpy = jest.spyOn(store, 'dispatch');
      const payload = {{ trigger_payload }};

      store.dispatch({
        type: {{ triggerThunkName }}.fulfilled.type,
        payload,
        meta: { arg: {{ trigger_meta_arg }}, requestId: 'test', requestStatus: 'fulfilled' },
      });

      await flushEffect();

      // Assert the response actions
      expect(dispatchSpy).toHaveBeenCalledWith({{ expected_response_action_1 }});
      expect(dispatchSpy).toHaveBeenCalledWith({{ expected_response_action_2 }});
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
import { configureStore } from '@reduxjs/toolkit';
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

const makeStore = () =>
  configureStore({
    reducer: () => ({}),
    middleware: gDM =>
      gDM({ serializableCheck: false, immutableCheck: false })
        .prepend(educationListener.middleware),
  });

const flush = () => new Promise(r => setImmediate(r));

describe('educationListener', () => {
  describe('fetchInitialEducationDetails.fulfilled', () => {
    it('SETs (not appends) on page 1', async () => {
      const store = makeStore();
      const spy = jest.spyOn(store, 'dispatch');
      const payload = { educationList: [{ id: 'edu-1' }] };

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload,
        meta: { arg: { page: 1, doctorId: 'doc-1' } },
      });
      await flush();

      expect(spy).toHaveBeenCalledWith(setEducationListAPI(payload));
      expect(spy).not.toHaveBeenCalledWith(appendEducationListAPI(payload));
    });

    it('APPENDs (not sets) on page > 1', async () => {
      const store = makeStore();
      const spy = jest.spyOn(store, 'dispatch');
      const payload = { educationList: [{ id: 'edu-2' }] };

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload,
        meta: { arg: { page: 2, doctorId: 'doc-1' } },
      });
      await flush();

      expect(spy).toHaveBeenCalledWith(appendEducationListAPI(payload));
      expect(spy).not.toHaveBeenCalledWith(setEducationListAPI(payload));
    });

    it('always dispatches updateVerifiedEducationsInOverview with SYNC actionType', async () => {
      const store = makeStore();
      const spy = jest.spyOn(store, 'dispatch');
      const payload = { educationList: [{ id: 'edu-1' }] };

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload,
        meta: { arg: { page: 1, doctorId: 'doc-1' } },
      });
      await flush();

      expect(spy).toHaveBeenCalledWith(
        updateVerifiedEducationsInOverview({
          educationAPI: payload.educationList,
          actionType: 'SYNC',
        }),
      );
    });

    it('dispatches resetAndAddDraftEducationList after loading drafts from SQLite', async () => {
      const drafts = [{ id: 'draft-1' }];
      require('src/database/dbUtil').DraftEducationService.getDrafts.mockResolvedValueOnce(drafts);

      const store = makeStore();
      const spy = jest.spyOn(store, 'dispatch');

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload: { educationList: [] },
        meta: { arg: { page: 1, doctorId: 'doc-1' } },
      });
      await flush();

      expect(spy).toHaveBeenCalledWith(resetAndAddDraftEducationList(drafts));
    });

    it('swallows SQLite errors silently (does NOT dispatch resetAndAddDraftEducationList on failure)', async () => {
      require('src/database/dbUtil').DraftEducationService.getDrafts.mockRejectedValueOnce(new Error('DB down'));

      const store = makeStore();
      const spy = jest.spyOn(store, 'dispatch');

      store.dispatch({
        type: fetchInitialEducationDetails.fulfilled.type,
        payload: { educationList: [] },
        meta: { arg: { page: 1, doctorId: 'doc-1' } },
      });
      await flush();

      const calls = spy.mock.calls.map(c => (typeof c[0] === 'object' ? c[0].type : c[0]));
      expect(calls).not.toContain(resetAndAddDraftEducationList.type);
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
