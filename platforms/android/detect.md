---
platform: android
priority: 30
---

# Platform detection — android

Recognize a native Android app/library repo (Gradle + Kotlin/Java) when the
rules below match for the target directory (the path passed to `/devkit:cover`).

`priority: 30` means this adapter is evaluated **after** `react-native` (10) and
`node` (20). Both of those require a `package.json`; a native Android repo has
none, so it falls through to here. The negative signal below keeps the `android/`
subfolder of a React Native repo out of this adapter.

## Rules

### Required signals (must all match)

1. **`settings.gradle` or `settings.gradle.kts` exists** (walk up to 6 levels
   from the target path to find it; that dir becomes `PLATFORM_ROOT`).

2. **`gradlew` exists** at `PLATFORM_ROOT` (Gradle wrapper).

3. At least one **Android signal**:
   - Any `AndroidManifest.xml` under the target module's `src/main/`, OR
   - A module build file applying `com.android.application` / `com.android.library`, OR
   - `com.android.tools.build:gradle` (AGP) in the root build file's classpath.

### Negative signals (must NOT match — bumps to another adapter)

- A `package.json` containing `react-native` at `PLATFORM_ROOT` or anywhere
  between the target path and `PLATFORM_ROOT` → this is the embedded `android/`
  folder of a React Native app; bump to `react-native`.
- No `settings.gradle(.kts)` anywhere up the tree → not Android; fail detection.

### Strong-confidence boosters

- `gradle.properties` with `android.useAndroidX=true`.
- Kotlin sources under `src/main/java/` or `src/main/kotlin/`.
- A `:test` shared test-utilities module in the `include` list (drives
  `HAS_TEST_MODULE_DEP` scaffolding).

## Resolving the Gradle module

`/devkit:cover` targets are files or directories; gradle test tasks are
per-module. Resolve:

1. Parse the `include ':a', ':b', …` list from `settings.gradle`.
2. `GRADLE_MODULE` = the include entry whose directory is an ancestor of the
   target path (longest match wins — nested modules exist).
3. If no include entry matches but the target is under `PLATFORM_ROOT/src/`,
   the target belongs to the **root/app project itself** → `GRADLE_MODULE=""`
   (empty; gradle tasks run WITHOUT a `:module:` prefix).
4. `MODULE_DIR` = the module's directory (`PLATFORM_ROOT` for the root project).

**Build file name gotcha:** some repos rename module build files via
`subProject.buildFileName` in `settings.gradle` (fabric-droid uses
`<module-name>.gradle`, e.g. `order/order.gradle`). Check for
`<MODULE_DIR>/build.gradle(.kts)` first, then `<MODULE_DIR>/<module-name>.gradle`.

## Resolving the unit-test task

Read the module's build file:

- Has `productFlavors { production … }` (or inherits app flavors) →
  `UNIT_TEST_TASK=testProductionDebugUnitTest`
- Flavors present but differently named → `test<FirstFlavor>DebugUnitTest`
- No flavors → `UNIT_TEST_TASK=testDebugUnitTest`

When unsure, `./gradlew :<module>:tasks --all | grep -i unittest` settles it.

## Output

When matched, set:

```
PLATFORM=android
PLATFORM_ROOT=<dir containing settings.gradle>
GRADLE_MODULE=<':order'-style include name, or empty for the root project>
MODULE_DIR=<absolute path to the module directory>
TEST_DIR=<MODULE_DIR>/src/test/java        # tests mirror the main source package
UNIT_TEST_TASK=<testProductionDebugUnitTest | testDebugUnitTest | …>
HAS_MOCKMAKER_INLINE=true|false            # <MODULE_DIR>/src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker exists
HAS_TEST_MODULE_DEP=true|false             # module build file has testImplementation project(':test')
HAS_ROBOLECTRIC=true|false                 # robolectric in the module's test deps
```

These flags drive `--setup`: skip steps already done in prior runs.

## Examples

| Path | Verdict | Notes |
|---|---|---|
| `fabric-droid/order/` | `android`, `GRADLE_MODULE=:order` | settings.gradle + gradlew + manifests |
| `fabric-droid/src/main/java/...` | `android`, `GRADLE_MODULE=""` (root project) | app shell sources live at repo root |
| `provider-app/packages/editors/` | NOT android | no settings.gradle up the tree → react-native |
| `some-rn-app/android/` | NOT android | package.json with react-native one level up → bumps to react-native |

## Fallback

If no platform matches, the command exits with:
```
Error: could not detect platform for <path>.
Supported platforms: react-native, node, android.
To add a platform, see devkit/platforms/README.md.
```
