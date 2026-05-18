---
platform: react-native
priority: 10
---

# Platform detection — react-native

Recognize a React Native package when ALL of the following are true within the target directory (the path passed to `/devkit:cover`):

## Rules

### Required signals (must all match)

1. **`package.json` exists** AND its merged dependencies (`dependencies` + `devDependencies` + `peerDependencies`) contain `react-native`.

2. **One of these is also true:**
   - The package itself has `react-native` directly, OR
   - A parent workspace `package.json` (walk up to 4 levels) has `react-native` AND the target's `package.json` declares `"react-native"` as a peerDep / has `*.tsx` or `*.jsx` files importing from `react-native`.

### Negative signals (must NOT match — bumps to other adapters)

- `next.config.js` or `next.config.ts` present → bump to `react` (Next.js, not RN).
- `vite.config.{js,ts}` with `@vitejs/plugin-react` and no `react-native` → bump to `react`.
- `*.swift` or `*.m`/`*.h` Xcode project files in a sibling `ios/` AND no `package.json` → bump to `ios`.
- `build.gradle{,.kts}` + `*.kt` AND no `package.json` → bump to `android`.

### Strong-confidence boosters

These don't change the match, but increase confidence (the report can flag uncertainty if missing):

- `babel.config.js` contains `babel-plugin-module-resolver` (alias support).
- `jest.config.js` exists with `preset: 'react-native'`.
- `metro.config.js` exists.
- Folder `__mocks__/` exists at the package root (Jest auto-discovery).

## Output

When matched, set:

```
PLATFORM=react-native
PLATFORM_ROOT=<path-to-package>     # the dir containing package.json
WORKSPACE_ROOT=<path-to-workspace>  # nearest ancestor with `workspaces:` in package.json, else PLATFORM_ROOT
HAS_BABEL_ALIASES=true|false        # presence of babel-plugin-module-resolver
HAS_JEST_CONFIG=true|false          # presence of jest.config.js with preset:'react-native'
HAS_MOCKS_DIR=true|false            # presence of __mocks__/ at package root
```

These flags drive the setup phase: skip steps already done in prior runs.

## Examples

| Path | Verdict | Notes |
|---|---|---|
| `provider-app/packages/editors/` | `react-native` | RN dep + babel aliases + jest config — fully matches |
| `provider-app/packages/onboarding/` | `react-native` | Same workspace, inherits all signals |
| `my-next-app/` | NOT react-native | `next.config.js` present → adapter `react` |
| `MyApp.xcodeproj/` parent dir with no `package.json` | NOT react-native | Native iOS only |

## Fallback

If no platform matches, the command exits with:
```
Error: could not detect platform for <path>.
Supported platforms: react-native.
To add a platform, see devkit/platforms/README.md (coming soon).
```
