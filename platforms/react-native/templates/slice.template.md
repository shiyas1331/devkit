---
classification: slice
file_extension: .test.ts
---

# Slice test template

For files that export from `createSlice(...)` in `@reduxjs/toolkit`.

## What to cover

Per slice, the test-engineer agent must produce one `it(...)` per:
1. Initial state shape (one happy-path describe)
2. Each non-trivial reducer (pure transitions)
3. Each `extraReducers` case (especially `fulfilled` handlers — they carry the most business logic)
4. Dedup / clamp / sort behaviour if present
5. Any conditional in a reducer (each branch)

Do NOT cover:
- Trivial setters (e.g. `setName(state, action) { state.name = action.payload }`) — skip unless they have validation/transformation.

## Template

```ts
/**
 * Slice test — {{ sliceName }}.
 *
 * {{ short purpose — one line }}
 *
 * {{ optional: non-obvious contracts list }}
 */
import {{ '{' }} {{ sliceName }}Reducer, {{ exportedActions.join(', ') }} {{ '}' }} from '../{{ moduleName }}';
{{ if uses_api_types }}
import type {{ '{' }} {{ apiType }} {{ '}' }} from '@api/doctorProfileApi/models/{{ modelFile }}';
{{ endif }}
{{ if uses_fixtures }}
import {{ '{' }} {{ fixtures.join(', ') }} {{ '}' }} from '@fixtures/{{ fixtureModule }}';
{{ endif }}

describe('{{ sliceName }}', () => {
  describe('initial state', () => {
    it('starts with {{ describe_initial_invariant }}', () => {
      const state = {{ sliceName }}Reducer(undefined, { type: '@@INIT' });

      {{ initial_state_assertions }}
    });
  });

  {{ for each reducer block }}
  describe('{{ reducerName }}', () => {
    it('{{ contract_description }}', () => {
      // ARRANGE
      const seeded = {{ sliceName }}Reducer(undefined, { type: '@@INIT' });

      // ACT
      const next = {{ sliceName }}Reducer(seeded, {{ actionCreator }}({{ payload }}));

      // ASSERT
      {{ assertion }}
    });

    {{ optional: more cases — dedup, clamp, conditional branches }}
  });
  {{ endfor }}

  {{ if has_extraReducers }}
  describe('extraReducers', () => {
    {{ for each extraReducer case }}
    it('{{ thunkName }}.fulfilled — {{ contract }}', () => {
      // ARRANGE
      const seeded = {{ sliceName }}Reducer(undefined, { type: '@@INIT' });

      // ACT — simulate the thunk's fulfilled action
      const action = { type: '{{ thunkType }}/fulfilled', payload: {{ payload }} };
      const next = {{ sliceName }}Reducer(seeded, action);

      // ASSERT
      {{ assertion }}
    });
    {{ endfor }}
  });
  {{ endif }}
});
```

## Worked example

Source: `educationListSlice.ts`
Test: `__tests__/educationListSlice.test.ts`

```ts
import { educationListReducer, addEducationToAddedList, removeEducationFromList } from '../educationListSlice';
import { makeEducation } from '@fixtures/makeEducation';

describe('educationListSlice', () => {
  describe('initial state', () => {
    it('starts with empty addedEducationList and educationAPIState', () => {
      const state = educationListReducer(undefined, { type: '@@INIT' });

      expect(state.educationUIState.addedEducationList).toEqual([]);
      expect(state.educationAPIState.educationList).toEqual([]);
    });
  });

  describe('addEducationToAddedList', () => {
    it('appends a new education to the added list', () => {
      const seeded = educationListReducer(undefined, { type: '@@INIT' });
      const edu = makeEducation({ id: 'edu-1' });

      const next = educationListReducer(seeded, addEducationToAddedList(edu));

      expect(next.educationUIState.addedEducationList).toEqual([edu]);
    });

    it('does NOT add a duplicate id (dedup regression — CAT-511)', () => {
      const edu = makeEducation({ id: 'edu-1' });
      const seeded = educationListReducer(undefined, addEducationToAddedList(edu));

      const next = educationListReducer(seeded, addEducationToAddedList(edu));

      expect(next.educationUIState.addedEducationList).toHaveLength(1);
    });
  });
});
```
