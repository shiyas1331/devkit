---
classification: service
file_extension: .test.ts
---

# SQLite service test template

For classes with static methods that hit `getDB()` from
`react-native-sqlite-storage`. The shim replaces real SQL with an in-memory
`Map<string, Map<id, row>>`.

## What to cover

1. Initial CRUD round-trip — write, read back, verify shape
2. Update — assert the new value replaces the old
3. Delete — assert the row is gone
4. Edge cases — duplicate key, missing row, malformed JSON
5. Case-insensitive matching (if the service does it — e.g. `customEntityService`)
6. Auto-increment id assignment (if relevant)

## Template

```ts
/**
 * Service test — {{ serviceName }}.
 *
 * In-memory shim replaces real SQLite. We seed initial rows and run the
 * service methods against the shim. Tests cover the CRUD methods and any
 * non-trivial query logic (case-insensitive search, duplicate detection).
 */
import { {{ serviceName }} } from '../{{ moduleName }}';

// In-memory shim. Keyed by table name → Map<id, row>.
const mockTables = new Map<string, Map<string | number, Record<string, unknown>>>();
let mockAutoIncrement = 0;

const mockExecuteSql = jest.fn(async (query: string, params: unknown[] = []) => {
  // Implement a minimal SQL subset: INSERT, SELECT, UPDATE, DELETE.
  // For tests, the agent should match on query keywords + table name.
  {{ minimal_sql_dispatcher_per_service }}
});

jest.mock('@database/db', () => ({
  __esModule: true,
  initDB: jest.fn(async () => {}),
  getDB: jest.fn(() => ({ executeSql: mockExecuteSql })),
}));

describe('{{ serviceName }}', () => {
  beforeEach(() => {
    mockTables.clear();
    mockAutoIncrement = 0;
    mockExecuteSql.mockClear();
  });

  it('{{ create_contract }}', async () => {
    await {{ serviceName }}.{{ createMethod }}({{ create_args }});

    {{ create_assertion }}
  });

  it('{{ read_contract }}', async () => {
    // ARRANGE — seed a row directly into the shim
    {{ seed_row }}

    // ACT
    const result = await {{ serviceName }}.{{ readMethod }}({{ read_args }});

    // ASSERT
    {{ read_assertion }}
  });

  it('{{ update_contract }}', async () => {
    {{ seed_row }}

    await {{ serviceName }}.{{ updateMethod }}({{ update_args }});

    {{ update_assertion }}
  });

  it('{{ delete_contract }}', async () => {
    {{ seed_row }}

    await {{ serviceName }}.{{ deleteMethod }}({{ delete_args }});

    {{ delete_assertion }}
  });

  {{ for each edge case }}
  it('{{ edge_case_contract }}', async () => {
    {{ edge_case_body }}
  });
  {{ endfor }}
});
```

## Worked example

See `packages/editors/src/database/__tests__/doctorDraftService.test.ts` and
`customEntityService.test.ts` in PR #471 for the full SQL shim implementation.

The agent's job: detect what tables and queries the service uses (by reading
its source), and generate a shim that handles only those.

## Honest scope note

The shim implements just enough SQL to make tests pass — not a full SQL
engine. If a service uses joins, transactions, or complex WHERE clauses, the
agent should mark `needs-human` and let an engineer write the shim by hand.
