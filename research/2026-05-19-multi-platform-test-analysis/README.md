# Multi-platform test pattern analysis — synthesis

**Date:** 2026-05-19
**Scope:** Inform design of `/devkit:cover` iOS + Android adapters
**Status:** Findings held — adapter implementation deferred

## Background

`/devkit:cover` works well for React Native (validated on CAT-494 + CAT-495 — 171 latent bugs caught, 3,700+ tests shipped in `packages/editors`). The next step is multi-platform support for:

- **iOS:** practo/fabric-ios (Health), practo/partner-ios (Doctor)
- **Android:** practo/partner-droid (PractoPro), practo/fabric-droid (Health)

This document captures the deep analysis done before any adapter code was written. Saved here because the findings reshape the adapter architecture meaningfully.

## Method

Spawned 4 parallel `general-purpose` agents, each analyzing one repo's actual test files via Read/Glob/Grep against local clones. Each agent sampled 6-10 test files across 3+ distinct modules, characterized patterns with `path:line` citations, checked build deps, and rated direction-of-travel.

Total evidence base: **386 test files across 4 repos**. Raw agent reports preserved in `raw/`.

## The single most important finding

**Style divergence is INTRA-repo, not just INTER-repo.**

Earlier proposals assumed each repo had one consistent house style and the adapter could pick the right one per repo. The evidence falsifies this. Every repo contains multiple coexisting test styles that vary by:

- **Module** (older modules vs newer feature areas)
- **Era** (2017-2018 vs 2025 vs 2026 work)
- **Architecture pattern** (VIPER vs MVVM vs MVC vs MVC+CoreData)
- **Author preference** (backtick vs underscore vs camelCase method names)

```
Repo            Tests   Sub-styles within ONE repo
──────────────────────────────────────────────────────────
fabric-ios       86     3+ era cohorts (2017-18 / 2025 GWT / 2026 Phase 4)
                        + 4 mocking patterns
                        + 8 pods with boilerplate-only shells
                        + 14 disabled stubs

partner-ios      87     7 mocking patterns coexisting (A-G):
                        boolean-flags / closure-bindings / static-enum
                        state machines / subclass-override / DBManagerMock /
                        UserDefaultsMock / OHHTTPStubs
                        + VIPER + MVVM + MVC mixed
                        + final vs class not enforced (51:17)

partner-droid    58     4 style cohorts:
                        Java-VM legacy / PowerMock-Kotlin hybrid /
                        Plain JUnit4 Kotlin / New pure-function
                        + alpha-prefixed Java methods (testA/B/C)
                        + backtick names arriving in 2026

fabric-droid    155     2-3 method-naming styles per file
                        + JUnit4 / Robolectric / no-runner
                        + Truth / custom infix / JUnit assertions
                        + dead PowerMock (1 scaffold, 0 consumers)
                        + mockito-kotlin Nhaarman fork (2.2.0)
```

## What this means for adapter architecture

The natural design instinct — `platforms/ios/` with one set of templates, `platforms/android/` with another — **doesn't fit reality.** It will produce tests that match some modules and look foreign in others within the same repo.

The right architecture is **neighbor-style detection:**

```
Before generating a test for <target-file>:
  1. Find the test folder where the new test will live
  2. Read 2-3 existing neighboring tests
  3. Extract their style markers:
     - Mock library imports
     - Test method naming convention
     - @RunWith / setUp pattern (Android)
     - SUT declaration style (iOS)
     - Assertion style
  4. Generate the new test matching the LOCAL style
```

This is closer to "test generation as style transfer" than "test generation from template."

## Shared invariants — can be platform-wide

These are uniform across both repos within a platform and can be templated globally:

```
iOS (both repos)                          Android (both repos)
─────────────────────────────────────────────────────────────────────
XCTest framework                          JUnit 4
override func setUp() no throws           InstantTaskExecutorRule for LiveData
No async/await in tests                   mockito-kotlin Nhaarman fork
                                          (com.nhaarman.mockitokotlin2)
XCTestExpectation for async               PowerMock being phased out everywhere
File header copyright block               No Compose UI tests in either repo
@testable import <Target>                 No @HiltAndroidTest despite Hilt standard
Hand-written mocks only — no Mockable     JaCoCo for coverage
or Cuckoo or Sourcery anywhere
```

## Divergent dimensions — must be neighbor-detected

```
iOS (per-folder)                         Android (per-file)
─────────────────────────────────────────────────────────────────────
Architecture: VIPER/MVVM/MVC             @RunWith: JUnit4/Robolectric/none
Mock pattern (7 variants)                Mock library: mockito-kotlin/MockK mix
Method naming (3+ conventions)           Method naming: backtick/underscore/camelCase
Storyboard vs programmatic VC            Coroutine infra: 4 different recipes
File header dropping in newest era       Assertion: Truth/infix-DSL/JUnit
final vs class                           Static mocking: mockStatic/mockkStatic
                                         setUp: top-level vals/@Before/Java init
```

## What we shouldn't auto-generate (evidence-based)

```
❌ PowerMock-based tests — being phased out in both Android repos
❌ Compose UI tests — zero in-repo precedent, team must design first
❌ @HiltAndroidTest — no precedent despite Hilt being the standard
❌ async/await iOS tests — zero in either iOS repo (all sync)
❌ ObjC tests — fabric-ios has 0 despite heavy ObjC legacy
❌ SwiftUI tests — no precedent in either iOS repo
❌ Tests modeled on disabled stubs (14 in fabric-ios)
❌ "Modern" style globally — neighbors should decide, not the adapter
```

## Per-platform infrastructure to reuse (don't recreate)

**iOS adapters should import, not regenerate:**

- `Bundle.loadFromFile(_:)` at `fabric-ios/PractoTests/Helpers/FileLoaderUtils.swift`
- `PRHTTPStubTestCase` base class at `fabric-ios/PractoTests/Helpers/RequestStubberHelpers.swift:13`
- `jsonResponse()`, `errorResponse()`, `hasPrefixBlock()` helpers
- `DBManagerMock`, `UserDefaultsMock`, `MockData` at `partner-ios/PractoBusinessTests/Mocks/`
- `TestUtils.getJSONfrom(file:)` at `partner-ios/PractoBusinessTests/Utils/TestUtils.swift`
- Per-pod `Base*APIMock` (BaseAPIMock, BaseFitAPIMock, BaseConsultAPIMock)

**Android adapters should import, not regenerate:**

- `com.practo.fabric.test.*` shared module (in fabric-droid)
- `TestCoroutinesRule` at `test/src/main/java/com/practo/fabric/test/coroutines/TestCoroutinesRule.kt:15-34`
- `getTestScheduler()` for RxJava in `test/src/main/.../TestUtils.kt:41`
- Custom infix `isEqualTo` from `test/src/main/.../TestUtils.kt:21-23`
- Per-module `MainCoroutineRule` (variant)
- Domain `StubFactory` / `TestHelper` objects per feature

## Scope estimate

```
Original (one platform = one style):                8-10 hours
After Options A/B/C divergence found:              14-18 hours
After this deep analysis:                          22-30 hours

Breakdown:
  Style detection layer per platform                ~6 hours
    (read neighbors → extract style markers)
  iOS templates (3-4 architecture variants):        ~8 hours
  Android templates (3-4 runner combinations):      ~6 hours
  Integration with /devkit:cover dispatch:          ~3 hours
  Smoke-testing against real files per repo:        ~4 hours
  Doc + iteration loop guidance:                    ~3 hours

Total: ~30 hours focused work, probably 4-5 sessions
```

## Recommended path forward

Given the actual complexity revealed, the pragmatic path is **prototype-first, then iterate** — not "design all templates upfront."

```
Step 1: Prototype neighbor-detection layer (~4 hours)
        Small command that takes a source path, finds test neighbors,
        reports "if I were generating here, I'd match style X because
        of signals Y, Z." Validate detection on real folders.

Step 2: If detection works, build iOS adapter incrementally
        Start with ONE pattern (e.g., partner-ios MVVM + closure bindings).
        Generate ONE test against ONE real file. Manually compare.
        Iterate the detection logic. Add patterns one at a time.

Step 3: Build Android adapter same way

Step 4: Multi-platform release happens organically as each adapter
        is validated against >= 3 real generated tests
```

This is closer to a research project than a feature ship. Trying to design all templates up-front against this much divergence will produce templates that look right on paper but generate foreign tests in practice.

## Honest framing if v1 must ship for CAT-456 deadline

```
v1 minimum (mediocre quality):
  - One template per platform with platform-wide invariants only
  - No neighbor detection
  - Documented prominently as "v1, manual refinement expected"
  - 8-10 hours
  - Risk: bad first impression spreads, hurts adoption

v1.5 (substantially better):
  - Add neighbor detection
  - Multiple sub-templates per platform
  - 22-30 hours
  - Same release window if started early enough
```

## Open decisions (for the next session)

1. **Adapter architecture:** neighbor-detection (recommended) vs flat platform templates (faster but lower quality)
2. **CAT-456 timeline:** is this driving a v1 deadline?
3. **Validation strategy:** who runs first generated tests against fabric-ios / partner-ios? (User mentioned: "another developer will handle iOS")
4. **Where to start:** iOS or Android? CAT-456 implies iOS-first.
5. **Compose / SwiftUI / Hilt:** explicitly out of scope for v1 — confirmed?

## Raw evidence

- `raw/fabric-ios-analysis.md`
- `raw/partner-ios-analysis.md`
- `raw/partner-droid-analysis.md`
- `raw/fabric-droid-analysis.md`

Each is the full agent-generated report with `path:line` citations. Use these to verify any claim in this synthesis or to extract additional patterns not surfaced here.

## References

- `/devkit:cover` source: `commands/cover.md` + `commands/cover/`
- Existing RN adapter: `platforms/react-native/`
- Plan for next iteration: TBD when work resumes
