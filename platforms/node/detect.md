---
platform: node
priority: 20
---

# Platform detection — node

Recognize a Node.js / TypeScript backend service when the rules below match
within the target directory (the path passed to `/devkit:cover`).

`priority: 20` means this adapter is evaluated **after** `react-native`
(`priority: 10`). React Native always wins its own repos; `node` is the
backend fallback. Lower priority number = checked first.

## Rules

### Required signals (must all match)

1. **`package.json` exists** (walk up to 4 levels to find the nearest one; that
   dir becomes `PLATFORM_ROOT`).

2. The merged dependencies (`dependencies` + `devDependencies`) contain
   **TypeScript tooling**: `typescript`, OR `ts-node`, OR `ts-node-dev`.

3. At least one **server / data-layer signal** in merged deps:
   - `mongoose` or `mongodb`
   - `@apollo/server` / `apollo-server*` / `graphql`
   - `express` / `koa` / `fastify` / `@nestjs/core`

### Negative signals (must NOT match — bumps to another adapter)

- Merged deps contain `react-native` → bump to `react-native`.
- `next.config.{js,ts}` present → bump to `react` (when that adapter exists).
- No `package.json` anywhere up the tree → not a Node package; fail detection.

### Strong-confidence boosters

These don't change the match, but increase confidence and drive scaffolding:

- `tsconfig.json` exists.
- `reflect-metadata` + `typedi` in deps → TypeDI dependency injection in use
  (drives `resetContainer()` scaffolding).
- `engines.node` declared in `package.json`.
- A `tests/` directory already exists at the package root.

## Output

When matched, set:

```
PLATFORM=node
PLATFORM_ROOT=<dir containing package.json>
TEST_DIR=tests/unit                 # centralized — tests are NOT co-located with source
HAS_JEST_CONFIG=true|false          # jest.config.{js,ts} present with a ts-jest preset/transform
HAS_TS_JEST=true|false              # ts-jest in devDependencies
HAS_TYPEDI=true|false               # reflect-metadata + typedi present → DI conventions apply
HAS_TS_PATHS=true|false             # tsconfig.json has compilerOptions.paths
```

These flags drive the setup phase: skip steps already done in prior runs.

## Examples

| Path | Verdict | Notes |
|---|---|---|
| `content-service/` | `node` | TS + mongoose + @apollo/server, no react-native — fully matches |
| `content-service/workers/` | `node` | Walks up to `content-service/package.json` |
| `provider-app/packages/editors/` | NOT node | `react-native` present → bumps to react-native |
| `some-cra-app/` | NOT node | No server/data signal; (react adapter, when it exists) |

## Fallback

If no platform matches, the command exits with:
```
Error: could not detect platform for <path>.
Supported platforms: react-native, node.
To add a platform, see devkit/platforms/README.md.
```
