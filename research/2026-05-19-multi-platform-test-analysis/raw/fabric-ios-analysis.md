# fabric-ios Test Pattern Analysis

> Source: `general-purpose` agent run on local clone of `practo/fabric-ios` (2026-05-19). Sampled 10+ test files across PractoTests + multiple pods with `path:line` citations.

## 1. Test inventory
- Total Swift test files: **86** (0 ObjC `.m` test files — repo has heavy ObjC legacy in production code, but **all tests are Swift**)
- 86 includes 4 UI tests + 82 unit tests; ~14 of the unit tests are disabled stubs (empty class body with comment) — see "Honest gaps".
- Top buckets by location (counted from the path list above):
  1. `PractoPods/DoctorFeedback/Example/Tests` — **21 files** (largest single pod, the only one with extensive test coverage)
  2. `PractoTests/Tests/...` — main app test target, split into ~18 feature subdirs. Densest subdirs: `MediaGalleryTests` (7), `ErrorClassificationTests` (8), `DoctorProfileTests` (5), `OffersTests` (3), `HomeTests` (2), `PHRTests` (3)
  3. `PractoPods/PRProfileKit-iOS/Example/Tests` — **4 files**
  4. Eight other pods (`PractoChatRepository`, `PractoChatCore`, `PractoChatUI`, `PractoHome`, `PractoPay-iOS`, `PRLog`, `PSThemes-iOS`, `PractoUploaderUI`, `FeatureFlags`) — **1 file each**, all are the boilerplate `Tests.swift` shell (see #5)

Files sampled (10):
- `.../PractoTests/Tests/OffersTests/MyOffersViewModelTest.swift` (ViewModel, OHHTTPStubs)
- `.../PractoTests/Tests/DoctorProfileTests/DoctorProfileRevampViewModelTests.swift` (modern ViewModel)
- `.../PractoTests/Tests/AccountsTests/AccountsAPIManagerTests.swift` (API client, currently commented-out)
- `.../PractoTests/Tests/HomeTests/HomeFlickerFixGatesTests.swift` (pure logic gates)
- `.../PractoTests/Tests/HomeTests/HomeAPIOrchestratorTests.swift` (delegate-mock + expectations)
- `.../PractoTests/Tests/MediaGalleryTests/MediaGalleryModelTests.swift` (Codable model)
- `.../PractoTests/Tests/MediaGalleryTests/DPMediaDetailsVMTests.swift` (ViewModel + stubs, 2025)
- `.../PractoTests/Tests/ErrorClassificationTests/TransientRetryTests.swift` (4 test classes in 1 file)
- `.../PractoTests/Tests/SupportTests/SupportSendbirdInitTests.swift` (validator + error code)
- `.../PractoPods/DoctorFeedback/Example/Tests/FeedbackFormViewModelTests.swift` + `MultipleChoiceCellTests.swift` + `APIClientTests.swift` (pod ViewModel, cell, disabled APIClient)
- `.../PractoPods/PRProfileKit-iOS/Example/Tests/PickerContainerControllerTest.swift` + `MultiSelectTagCellTests.swift` (storyboard VC, nib cell)
- `.../PractoPods/PractoChatRepository/Example/Tests/Tests.swift` (boilerplate shell)

## 2. Patterns (with citations)

### Test class naming
Plain `XxxTests` (mostly) — `Tests` plural is dominant but **not enforced**:
- `MyOffersViewModelTest.swift:14` — `class MyOffersViewModelTest: PRHTTPStubTestCase` (singular `Test`)
- `PickerContainerControllerTest.swift:13` — `class PickerContainerControllerTest: XCTestCase` (singular)
- `MediaGalleryModelTests.swift:12` — `class MediaGalleryModelTests: XCTestCase`
- `HomeAPIOrchestratorTests.swift:35` — `final class HomeAPIOrchestratorTests: XCTestCase` (only `final` example I found among samples)
- Multiple classes in one file: `TransientRetryTests.swift:16`, `:88`, `:142`, `:158`, `:220` — five `XCTestCase` subclasses grouped by `// MARK: -`

### Test method naming — **three styles coexist, no winner**
- camelCase, no underscore (older + DoctorFeedback pod): `testNumberOfSections` (`MyOffersViewModelTest.swift:60`), `testCellHasTagView` (`MultiSelectTagCellTests.swift:23`), `testViewModelProvidesTipsDataSource` (`FeedbackFormViewModelTests.swift:15`)
- camelCase with underscore separators (newer "Phase 4", error-classification, home gates): `testTooManyRequests429_IsRetryable` (`TransientRetryTests.swift:19`), `testCannotConnectToHost_IsNetworkError_NotDNS` (`:61`)
- `test_snakeCase_whenCondition_shouldOutcome` (2025 MediaGallery + Flicker tests): `test_MediaItem_whenDecoded_shouldParseCorrectly` (`MediaGalleryModelTests.swift:15`), `test_isReady_whenReadinessSignalFired_returnsTrueRegardlessOfOtherInputs` (`HomeFlickerFixGatesTests.swift:7`), `test_init_whenInitialized_shouldSetInitialValues` (`DPMediaDetailsVMTests.swift:38`)

### SUT declaration
Two patterns:
- Property declared `!` (IUO), set in `setUp()` — dominant: `viewModel: DPMediaDetailsVM!` (`DPMediaDetailsVMTests.swift:14`); `orchestrator: HomeAPIOrchestrator!` (`HomeAPIOrchestratorTests.swift:36`); `viewModel: DoctorProfileRevampViewModel!` (`DoctorProfileRevampViewModelTests.swift:10`); `multiSelectCell: MultiSelectTagTableCell!` (`MultiSelectTagCellTests.swift:13`)
- `let sut = MockXxx()` immediate init (DoctorFeedback pod): `let sut = MockFeedbackFormViewModel()` (`FeedbackFormViewModelTests.swift:13`) — **only 1 file in my sample uses `sut` naming**; everyone else uses domain names (`viewModel`, `orchestrator`).
- Local-only SUT inside the test func (older offers code): `MyOffersViewModelTest.swift:61`

### Mocking — multiple coexisting patterns
- **A. Hand-written Mock class conforming to a protocol** — most common. `MockOffersView: MyOffersViewControllerProtocol` (`MyOffersViewModelTest.swift:190`); `MockPickerPresenter: PickerPresenterInterface` (`PickerContainerControllerTest.swift:47`); `MockHomeAPIOrchestratorDelegate: HomeAPIOrchestratorDelegate` (`HomeAPIOrchestratorTests.swift:15`, `private final` — only sample using access modifier).
- **B. Subclass override of the real class** — `class MockFeedbackFormViewModel: FeedbackFormViewModel` overrides `init()` (`FeedbackFormViewModelTests.swift:44`); `MockNetworkManager: APIManager` (`AccountsAPIManagerTests.swift:541`).
- **C. Singleton replacement** — `AccountsAPIManager.manager = MockNetworkManager()` (`AccountsAPIManagerTests.swift:19`) — swap the module-level singleton in `setUp`.
- **D. OHHTTPStubs intercept** — `stub(condition: ..., response: jsonResponse("..."))` (`MyOffersViewModelTest.swift:156`, `DPMediaDetailsVMTests.swift:61`). Used when SUT calls real network code unmodified.
- No Mockingbird / Cuckoo / Sourcery anywhere (grep returned 0).
- No protocol-typed `protocol Mock*Protocol` separately — mocks conform to the production protocol directly.

### setUp / tearDown lifecycle
- **Old-style `override func setUp()` / `override func tearDown()` everywhere** — `MyOffersViewModelTest.swift:18`, `DPMediaDetailsVMTests.swift:17,29`, `HomeAPIOrchestratorTests.swift:39,46`, `MultipleChoiceCellTests.swift:17`.
- **Zero `setUpWithError` / `tearDownWithError` (throws) found** — grep returned no matches anywhere in repo. Modern Xcode template signatures are not adopted.
- Base class for stubbed tests: `class PRHTTPStubTestCase: XCTestCase` defined at `PractoTests/Helpers/RequestStubberHelpers.swift:13` — auto-runs `HTTPStubs.removeAllStubs()` in `tearDown`. Used inconsistently — `MyOffersViewModelTest.swift:14` extends it, but `DPMediaDetailsVMTests.swift:13` doesn't (extends `XCTestCase` and manually calls `OHHTTPStubs.removeAllStubs()` at `:32`).

### Async pattern
- **`XCTestExpectation` + `waitForExpectations(timeout: 5)`** everywhere — `MyOffersViewModelTest.swift:160-163`, `HomeAPIOrchestratorTests.swift:57-65,72-73`, `DPMediaDetailsVMTests.swift:71-79`.
- Inverted expectations for "should NOT fire": `expectation.isInverted = true` (`HomeAPIOrchestratorTests.swift:58,83`).
- **No async/await test functions** — grep `async func test|await ` returned 0 hits in `PractoTests/`. No Combine `XCTestExpectation` extensions.
- Network simulation via `DispatchQueue.main.asyncAfter(deadline: .now() + 0.5)` then expectation fulfill (`DPMediaDetailsVMTests.swift:72-78`) — a workaround for not having callback hooks.

### Assertions
- Pure XCTest: `XCTAssertEqual`, `XCTAssertTrue/False`, `XCTAssertNotNil/Nil`, `XCTAssertGreaterThanOrEqual`, `XCTFail` for unhappy `do-catch` branches (`AccountsAPIManagerTests.swift:48,55`).
- **Optional message strings are heavily used** — `XCTAssertEqual(rowCount, 1, "Enter coupon cell is not present")` (`MyOffersViewModelTest.swift:98`).
- No Nimble `expect(...).to(equal(...))` anywhere — grep returned 0.
- Enum case extraction via `if case .x(let v) = card { ... } else { XCTFail("Expected x") }` (`MediaGalleryModelTests.swift:163-168`).

### Test data / fixtures
- **JSON fixtures in `PractoTests/Resources/<Feature>/Fixture.json`** loaded via `Bundle.loadFromFile("FixtureName")` helper at `PractoTests/Helpers/FileLoaderUtils.swift`. Usage: `Bundle.loadFromFile("OfferValid")` (`MyOffersViewModelTest.swift:26`), `Bundle.loadFromFile("CouponsValid")` (`:38`).
- **OHHTTPStubs JSON responses**: `jsonResponse("CouponsWithExpiredCoupons.json")` (`MyOffersViewModelTest.swift:156`) — helper at `RequestStubberHelpers.swift:20`.
- **Inline triple-quoted JSON literals** (newer 2025 style): `MediaGalleryModelTests.swift:17-25`, `:62-70` — bypasses bundle entirely.
- **Test-data provider singletons**: `FeedbackTestDataProvider.sharedInstance.feedbackCampaignModel` (`FeedbackFormViewModelTests.swift:47`) — pod-specific.
- **Helper factories on the test class**: `makePatientStoriesModel(totalCount:)` (`DoctorProfileRevampViewModelTests.swift:22`), `createMockMediaDetailsResponse()` referenced in `DPMediaDetailsVMTests.swift:63`.

### Imports
- `@testable import Practo` (main target) or `@testable import DoctorFeedback` / `@testable import PRProfileKit_iOS` (pod tests) — `FeedbackFormViewModelTests.swift:9`, `PickerContainerControllerTest.swift:9`.
- `OHHTTPStubs` imported only where stubbing used — `MyOffersViewModelTest.swift:9`, `DPMediaDetailsVMTests.swift:9`.
- `XCTest` always last in alphabetical sort (CLAUDE.md says SwiftLint enforces `sorted_imports`) — e.g. `DPMediaDetailsVMTests.swift:9-11`: `import OHHTTPStubs`, `@testable import Practo`, `import XCTest`. Pod tests sort similarly: `@testable import DoctorFeedback`, `import PSThemes_iOS`, `import XCTest` (`MultipleChoiceCellTests.swift:9-11`).

### File headers
- **Standard Xcode template header retained**, even on 2025 files:
  ```
  //
  //  FileName.swift
  //  PractoTests
  //
  //  Created by <Name> on <DD/MM/YY>.
  //  Copyright © YYYY Practo. All rights reserved.
  //
  ```
  See `MyOffersViewModelTest.swift:1-7`, `MediaGalleryModelTests.swift:1-7`, `DPMediaDetailsVMTests.swift:1-7`.
- Some newer files **drop the Created-by line** but keep target + copyright (`TransientRetryTests.swift:1-9` adds a "Phase 4 Tests:" purpose comment; `DoctorProfileRevampViewModelTests.swift:1-4` is the most minimal).
- Disabled test files keep the header + add a "Tests disabled:" rationale comment then an empty class body (`APIClientTests.swift:1-13`).

## 3. Build deps
- **Podfile** (`Podfile:144-150`): PractoTests target adds only `pod 'OHHTTPStubs/Swift'`. `inherit! :search_paths` from `Practo` target. No Quick/Nimble/Mockingbird/Sourcery.
- **Per-pod podspec test deps**: `DoctorFeedback.podspec:1-47` and `PRProfileKit-iOS.podspec:1-39` **do NOT declare `test_spec`** — tests live alongside CocoaPods-generated Example app (`Example/Tests/`) and run via `pod try` / Example Xcode project, not the podspec test runner. Test deps pulled transitively from `Example/Podfile`.
- **SPM**: not used (Podfile-only repo; CLAUDE.md confirms CocoaPods 1.16.0).

## 4. Source classifications
- ViewModel — naming `XxxViewModel.swift`, located alongside feature in `Practo/<Feature>/...` (`Practo/Plus/Appointment/AppointmentUnlockViewModel.swift`, `Practo/PDP/PDPScreenViewModel.swift`, `Practo/Reviews/EstablishmentFeedback/EstablishmentFeedbackViewModel.swift`).
- ViewController — `XxxViewController.swift`, same folder (`Practo/Reviews/DoctorReviews/PractoDoctorReviewViewController.swift`).
- Service / API — `XxxAPIManager.swift` is the canonical name (`Practo/Accounts/AccountsAPIManager.swift`, `Practo/Plus/PlusAPIManager.swift`, `Practo/Core/NewHome/PractoSwiftUIHome/NetworkManager/HomeAPIManager.swift`). `APIClient` exists only inside `DoctorFeedback` pod. No `Repository` pattern in main app; `PractoChatRepository` is a pod-named module, not a per-feature repo.
- Models — Codable structs, mixed locations. No dedicated `Models/` convention.
- Cells — `XxxTableViewCell.swift` / `XxxCell.swift` for UITableViewCell — pod tests typically test these by loading the nib (`MultiSelectTagCellTests.swift:18-20`) or dequeuing from the parent VC's storyboard (`MultipleChoiceCellTests.swift:21-27`).
- **Tests are NOT colocated with source** — they live in `PractoTests/Tests/<Feature>Tests/` (per CLAUDE.md and confirmed by paths above). Pod tests live in `PractoPods/<Pod>/Example/Tests/`.

## 5. Direction of travel
Couldn't run git log (sandbox denied), but file-content evidence is clear:

**Oldest era (2017–2018)** — `MyOffersViewModelTest.swift` (2018-01), `AccountsAPIManagerTests.swift` (2018-01), `FeedbackFormViewModelTests.swift` (2017-10), `PickerContainerControllerTest.swift` (2017-02), pod `Tests.swift` shells:
- Plain camelCase test names, singular `Test` suffix sometimes
- Inline JSON fixtures via `Bundle.loadFromFile`
- Heavy `XCTFail("…")` + `do-catch` for JSON parsing
- `XCTestExpectation` for async

**Middle era (2025)** — `MediaGalleryModelTests.swift`, `DPMediaDetailsVMTests.swift`, `DoctorProfileRevampViewModelTests.swift`:
- `test_snake_when_should` Given/When/Then naming + `// MARK: - Given/When/Then` comments
- Triple-quoted inline JSON literals over bundle fixtures
- Modern `viewModel: SUT!` IUO property + `setUp/tearDown` lifecycle
- Still no async/await, still XCTestExpectation

**Newest era (2026, Phase 4 — `TransientRetryTests.swift`, `HomeFlickerFixGatesTests.swift`, `HomeAPIOrchestratorTests.swift`)**:
- `final class XxxTests`, `private final class MockXxx` access modifiers
- Multiple `XCTestCase` subclasses per file split by `// MARK: -`
- `testCamelCase_Underscored_Condition` style (3rd convention!)
- Inverted expectations (`isInverted = true`)
- Removes some tests with a comment explaining why ("RestManager pod is not linked into the test target, so instantiating crashes")

**Migration is partial — three style cohorts coexist.** The 2025+ files clearly lean Given/When/Then but the newest 2026 Phase-4 work picked a *different* naming convention (underscored, not snake_case). No global cleanup.

## 6. Style consistency
**Varies by pod AND within-pod variation AND by era.** Three specific cohorts:
- **DoctorFeedback pod**: `sut = MockXxxViewModel()` immediate-init pattern, subclass-override mocks, camelCase tests, storyboard-loaded cells via parent VC.
- **PRProfileKit pod**: Hand-written protocol-conforming mocks, `setUp()` with storyboard `instantiateFrom`, nib-loaded cells via `Bundle.loadNibNamed`, camelCase tests.
- **PractoTests (main app)**: Itself splits — older `PRHTTPStubTestCase`-extending camelCase (`MyOffersViewModelTest`), 2025 Given/When/Then snake_case (`MediaGalleryModelTests`, `DPMediaDetailsVMTests`), 2026 Phase-4 underscored multi-class files (`TransientRetryTests`).
- **8 pods have boilerplate-only shells** (`PractoChatRepository/Example/Tests/Tests.swift:1-16`): a single `testExample()` + `testPerformanceExample()` — no actual coverage, no per-pod test patterns to mimic.

The adapter must pick **per-target style**, not a single global convention.

## 7. Honest gaps
- **Zero ObjC tests** despite heavy ObjC production code (CLAUDE.md confirms `Practo/PractoAppDelegate.m`). Adapter only needs to output Swift.
- **~14 disabled test stubs** (`DoctorProfileViewModelTests.swift:1-13`, `DoctorProfileVCTests.swift:1-13`, `APIClientTests.swift:1-13`, all 8 pod boilerplate shells) — using them as patterns would yield empty output. Adapter should detect "Tests disabled:" / `class X: XCTestCase {}` shells and skip them as templates.
- **No SwiftUI-specific test files found** in samples — CLAUDE.md mentions SwiftUI is new, but no `XxxView` SwiftUI tests exist yet. Adapter has no in-repo precedent for SwiftUI snapshot/view inspection tests.
- **No coverage of SDUI components** despite CLAUDE.md calling SDUI the "primary pattern for new screens." No `SDUIxxxTests.swift` exists.
- **Couldn't run `git log`** (sandbox denied bash for repo outside cwd) — "direction of travel" inferred from comments + Created-by dates + content style only, not commit timestamps.
- **No protocol-mock generator (Sourcery/Mockingbird) usage** despite the volume of hand-written mocks. Manual mocking is the house style — adapter should generate hand-written mocks, not `@Mock`-annotated stubs.
- **Helper utilities to surface to the adapter**: `Bundle.loadFromFile(_:)` at `PractoTests/Helpers/FileLoaderUtils.swift`, `jsonResponse(_:)` + `hasPrefix(_:)` + `errorResponse(_:)` at `PractoTests/Helpers/RequestStubberHelpers.swift:20-50`, `PRHTTPStubTestCase` base at `:13`, `XCTestCase+WaitingHelpers.swift`. Adapter should import these by reference rather than re-create.

**Adapter takeaway:** there is NOT one house style. Detect target via path prefix (`PractoTests/Tests/<Feature>Tests/` vs `PractoPods/<Pod>/Example/Tests/`) and **further detect by neighbors** in the same `<Feature>Tests/` folder — match the existing file style there. Default for "new feature folder" should be the 2025 Given/When/Then snake_case with IUO SUT, hand-written protocol-conforming mock class, `// MARK: -` section markers, classic `setUp`/`tearDown` (no `throws`), XCTestExpectation for async, OHHTTPStubs via `PRHTTPStubTestCase`/`jsonResponse` helpers, fixtures inline as triple-quoted JSON unless they exceed ~30 lines (then `Bundle.loadFromFile`).
