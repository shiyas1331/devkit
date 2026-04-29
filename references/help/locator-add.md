# /devkit:locator-add — Help Reference

Auto-instrument React Native library components with `testID` and `accessibilityLabel` forwarding plus default derivation from semantic props (text/label/placeholder).

App / consumer code is not touched. After the library is instrumented and rebuilt, every consumer call site automatically gets a sensible testID — no per-call-site changes needed.

---

## Scenario menu

```
1. Instrument a single component file
   Example: 1 omega/self-serve/src/components/atoms/Button/Button.tsx

2. Instrument a directory (recursive)
   Example: 2 omega/self-serve/src/components/atoms

3. Instrument the entire library
   Example: 3 omega/self-serve/src

4. Dry-run (audit only — print the would-be changes, no file mutations)
   Example: 4 omega/self-serve/src/components/atoms

5. Custom naming convention
   Example: 5 --naming=screen omega/self-serve/src
   (Note: in library mode, only --naming=role does anything in v1; screen/full warn and fall back.)
```

---

## Number → command mapping

- `1 <path>` → `/devkit:locator-add <path>`
- `2 <path>` → `/devkit:locator-add <path>`
- `3 <path>` → `/devkit:locator-add <path>`
- `4 <path>` → `/devkit:locator-add <path> --dry-run`
- `5 --naming=<value> <path>` → `/devkit:locator-add <path> --naming <value>`

---

## Verbose flag reference

```
/devkit:locator-add <path> [--dry-run] [--naming role|screen|full]
```

| Flag | Default | Description |
|---|---|---|
| `<path>` | required | File, directory, or glob. Must be inside a recognized library (has package.json). |
| `--dry-run` | off | Audit only. Prints the report without modifying any files. Recommended for the first run. |
| `--naming` | `role` | Naming convention for derived testIDs. `role` produces `update-profile-button`. `screen` and `full` are no-ops in library mode v1 (they require app-mode tooling) and fall back to `role` with a warning. |

---

## What the tool does

For each `.tsx` / `.jsx` / `.ts` / `.js` file in the input path:

1. Skip files that don't export a React component.
2. Skip files where the exported component's JSX root isn't a native primitive (`View`, `TouchableOpacity`, `Pressable`, `TextInput`, `Switch`, etc.) — those are compound components that delegate to children.
3. Skip files already instrumented (idempotent — safe to re-run).
4. For candidates:
   - Add `testID?: string` and `accessibilityLabel?: string` to the props interface (or inline type).
   - Add both to the destructure pattern.
   - Forward both to the JSX root.
   - Insert a derivation expression: `testID ?? deriveTestId(text ?? label ?? placeholder, '<component-suffix>')`.
   - Add an import for `deriveTestId` from the library's `src/utils/locator.ts` helper (creates the helper file if it doesn't exist).

Component-suffix mapping:
- `TouchableOpacity`, `Pressable`, `TouchableHighlight`, `TouchableWithoutFeedback` → `button`
- `TextInput` → `input`
- `Switch` → `switch`
- `Image` (interactive only) → `image`
- `View` / `ScrollView` (with `onPress` or used as button-like) → `button`

Derivation source priority: `text` → `label` → `placeholder` → `accessibilityLabel` → first child `<Text>` literal content.

For list-row components (component name matches `/Item$|Row$|Card$/i` AND has a name-like prop such as `name`, `text`, `*Name`, `title`):
- testID is hardcoded to a stable role string (e.g., `establishment-row`)
- The name-like prop is forwarded to `accessibilityLabel`

---

## Examples

### Library Button before
```tsx
interface ButtonProps {
  text: string;
  onPress: () => void;
}

export const Button = ({ text, onPress }: ButtonProps) => (
  <TouchableOpacity onPress={onPress}>
    <Text>{text}</Text>
  </TouchableOpacity>
);
```

### Library Button after
```tsx
import { deriveTestId } from '../../../utils/locator';

interface ButtonProps {
  text: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

export const Button = ({ text, onPress, testID, accessibilityLabel }: ButtonProps) => (
  <TouchableOpacity
    onPress={onPress}
    testID={testID ?? deriveTestId(text, 'button')}
    accessibilityLabel={accessibilityLabel}
  >
    <Text>{text}</Text>
  </TouchableOpacity>
);
```

### Consumer call site (no changes needed)
```tsx
<Button text="Update Profile" onPress={...} />
// → testID="update-profile-button" automatically
```

### List-row component
```tsx
// Before
export const EstItemGeneral = ({ estName, onPress }: Props) => (
  <TouchableOpacity onPress={onPress}>
    <Text>{estName}</Text>
  </TouchableOpacity>
);

// After
export const EstItemGeneral = ({ estName, onPress, testID, accessibilityLabel }: Props) => (
  <TouchableOpacity
    onPress={onPress}
    testID={testID ?? 'establishment-row'}
    accessibilityLabel={accessibilityLabel ?? estName}
  >
    <Text>{estName}</Text>
  </TouchableOpacity>
);
```

---

## What the tool does NOT do

- **Does not touch consumer / app code.** Only library files. App code stays clean — call sites get testIDs automatically once the library is updated.
- **Does not detect collisions.** If two `<Button text="Cancel" />` exist on the same screen, both auto-derive to `cancel-button`. Cross-screen reuse is fine (Appium only sees the current screen). Same-screen sibling collisions are rare — dev handles by passing an explicit testID.
- **Does not commit or push.** Run, review the diff, open the PR yourself.
- **Does not support iOS native, Android native, or React web.** RN-only in v1.
- **Does not auto-fix the runtime-UUID antipattern** (`testID={\`x-${id}\`}`). Leaves alone — dev decides whether to clean up.

---

## Idempotency

Re-running the command on already-instrumented files produces no changes. Safe to run repeatedly during development.

---

## Recovery

The tool does not commit. Any unwanted change is reverted with:

```
git checkout -- <file>
```

Or to revert all changes from a run:
```
git diff <library-root> | head -1   # confirm only library files were touched
git checkout -- <library-root>
```
