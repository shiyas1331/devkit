---
classification: thunk
file_extension: .test.ts
---

# Thunk test template

For files that export from `createAsyncThunk(...)`. Covers both REST thunks
(via `apiClient`) and direct `fetch()` thunks.

## What to cover

Per thunk, produce one `it(...)` per:
1. Happy path — mocked apiClient resolves, assert returned payload
2. Each branch in URL or body construction (e.g. `if (relationId) ...`)
3. Each early-return shortcut (e.g. "returns undefined when nameQuery is empty")
4. Error/rejection — mocked apiClient rejects, thunk rejects with same message
5. Side-effect mutations (e.g. `response.data.isPaging = page > 1`)

Also assert:
- `lastCallArg().method` matches expected HTTP verb
- `lastCallArg().url` contains the expected path + query params
- `lastCallArg().body` is the request payload (POST/PATCH/DELETE)

## Template

```ts
/**
 * Thunk test — {{ thunkName }}.
 *
 * {{ short purpose }}
 *
 * {{ optional: notable behaviour — early returns, query params, mutations }}
 */
import { configureStore } from '@reduxjs/toolkit';
import { {{ thunkName }} } from '../{{ moduleName }}';
{{ if uses_fixtures }}
import { {{ fixtures.join(', ') }} } from '@fixtures/{{ fixtureModule }}';
{{ endif }}

jest.mock('@api/apiClient', () => ({
  __esModule: true,
  apiClient: jest.fn(),
  HttpMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' },
}));

{{ if imports_requestHeadersStore }}
jest.mock('@provider-store/requestHeadersStore', () => ({
  __esModule: true,
  getProfileType: jest.fn(() => 'DOCTOR'),
  getApiRequestHeaders: jest.fn(() => ({})),
}));
{{ endif }}

{{ if imports_customEntityService }}
jest.mock('src/database/customEntityService', () => ({
  __esModule: true,
  CustomEntityService: { getCustomEntities: jest.fn() },
}));
{{ endif }}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@api/apiClient');
const mockedApiClient = apiClient as jest.Mock;

const makeStore = () =>
  configureStore({
    reducer: () => ({}),
    middleware: gDM => gDM({ serializableCheck: false, immutableCheck: false }),
  });

const lastCallArg = () => mockedApiClient.mock.calls[mockedApiClient.mock.calls.length - 1][0];

{{ if response_wrapped_in_data }}
const wrap = <T,>(payload: T) => ({ data: payload });
{{ endif }}

describe('{{ thunkName }}', () => {
  beforeEach(() => mockedApiClient.mockReset());

  it('{{ happy_path_contract }}', async () => {
    mockedApiClient.mockResolvedValue({{ resolved_value }});

    const store = makeStore();
    const result = await store
      .dispatch({{ thunkName }}({{ args }}) as never)
      .unwrap();

    {{ payload_assertion }}
    expect(lastCallArg().method).toBe('{{ method }}');
    expect(lastCallArg().url).toContain('{{ url_fragment }}');
    {{ if has_body }}
    expect(lastCallArg().body).{{ body_matcher }};
    {{ endif }}
  });

  {{ for each branch }}
  it('{{ branch_contract }}', async () => {
    {{ branch_test_body }}
  });
  {{ endfor }}

  it('propagates apiClient errors', async () => {
    mockedApiClient.mockRejectedValue(new Error('Boom'));

    const store = makeStore();
    await expect(
      store.dispatch({{ thunkName }}({{ minimal_args }}) as never).unwrap(),
    ).rejects.toMatchObject({ message: 'Boom' });
  });
});
```

## Worked example — POST thunk with id-diff

Source: `PostEducationDetail.ts`
Test: `__tests__/PostEducationDetail.test.ts`

```ts
import { configureStore } from '@reduxjs/toolkit';
import { postEducationDetail } from '../PostEducationDetail';
import { makeApiEducation } from '@fixtures/makeEducation';
import educationListReducer from '@store/doctorProfileStore/education/educationListSlice';

jest.mock('@api/apiClient', () => ({
  __esModule: true,
  apiClient: jest.fn(),
  HttpMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' },
}));

const { apiClient } = require('@api/apiClient');
const mockedApiClient = apiClient as jest.Mock;

describe('postEducationDetail', () => {
  beforeEach(() => mockedApiClient.mockReset());

  it('returns the NEW item by id-diffing against existing state (CAT-511)', async () => {
    // The thunk reads existing IDs from state, then picks the one new item from the response.
    const existing = [makeApiEducation({ id: 'A' }), makeApiEducation({ id: 'B' })];
    const apiResponse = [...existing, makeApiEducation({ id: 'C_new' })];
    mockedApiClient.mockResolvedValue({ data: { educationList: apiResponse } });

    const store = configureStore({
      reducer: { doctorProfile: { education: { educationList: educationListReducer } } } as never,
      preloadedState: {
        doctorProfile: {
          education: {
            educationList: {
              educationAPIState: { educationList: existing },
              educationUIState: { addedEducationList: [] },
            },
          },
        },
      } as never,
      middleware: gDM => gDM({ serializableCheck: false, immutableCheck: false }),
    });

    const result = await store.dispatch(postEducationDetail({ doctorId: 'doc-1' }) as never).unwrap();

    expect(result.id).toBe('C_new');
  });
});
```
