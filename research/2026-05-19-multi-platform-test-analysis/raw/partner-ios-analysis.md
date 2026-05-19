# partner-ios Test Pattern Analysis

> Source: `general-purpose` agent run on local clone of `practo/partner-ios` (2026-05-19). Sampled 10+ test files across 5+ feature areas with `path:line` citations.

## 1. Test inventory
- **Total test files (`.swift` under `PractoBusinessTests/`): 87** (Mocks + helpers included)
- **Feature areas — top 5 by file count:**
  - Ray — 25 (Calendar, Patient, Sync, Trial)
  - Fit — 13
  - Consult — 11
  - Profile — 7 (VIP — `Profile/L3/`)
  - Authentication — 6 (+ subdir `EmailLogin/`)
  - Transactions — 6, Reach — 6, Reports — 1, Prescription — 1, Interstitial — 1
- **Files sampled (≥3 areas: Reach VIPER, Auth VM, Ray VM, Ray VC, Consult Cell, Fit Model, Transactions VM, Reports VM):**
  - `PractoBusinessTests/Reach/SubscriptionList/PRESubscriptionListPresenterTests.swift`
  - `PractoBusinessTests/Reach/SubscriptionList/PRESubscriptionListInteractorTests.swift`
  - `PractoBusinessTests/Reach/SubscriptionDetails/PRESubscriptionDetailsViewModelTests.swift`
  - `PractoBusinessTests/Authentication/EmailLogin/PPEmailLoginViewModelTests.swift`
  - `PractoBusinessTests/Ray/Calendar/AppointmentListVMTests.swift`
  - `PractoBusinessTests/Ray/Patient/PatientListViewControllerTests.swift`
  - `PractoBusinessTests/Consult/Dashboard/ConsultStatsCellTests.swift`
  - `PractoBusinessTests/Fit/FitEditorFeedbackModelTests.swift`
  - `PractoBusinessTests/Transactions/CampaignSummary/CampaignSummaryViewModelTests.swift`
  - `PractoBusinessTests/Reports/ReportsViewModelTests.swift` (network-stub VM)
  - `PractoBusinessTests/Profile/L3/EstablishmentPreviewInteractorTests.swift` (extra VIP sample)
  - Cross-cutting: `Mocks/{BaseAPIMock,BaseFitAPIMock,DBManagerMock,MockData,UserDefaultsMock}.swift`, `Utils/{TestUtils,RequestStubberHelpers}.swift`

## 2. Patterns (path:line citations)

### Test class naming
Class name mirrors SUT + `Tests` suffix. Conventions vary by what SUT is:
- `<Feature>VMTests` (Ray): `AppointmentListVMTests.swift:14`
- `<Feature>ViewModelTests` (Auth/Transactions/Reach): `PPEmailLoginViewModelTests.swift:116`, `CampaignSummaryViewModelTests.swift:12`
- `<Class>Tests` (presenter/interactor/cell/model): `PRESubscriptionListPresenterTests.swift:56`, `EstablishmentPreviewInteractorTests.swift:36`, `ConsultStatsCellTests.swift:14`
- Some files use `Test` singular (Ray Patient subdir): `PatientListCellTest.swift`, `AppointmentTableCellTest.swift`, `FileTableCellTest.swift` — inconsistency.

### Test method naming
Universal: `testCamelCase`. Two flavors:
- Descriptive sentence form: `testThatPatientListControllerSetTableViewDatasource` (`PatientListViewControllerTests.swift:45`), `testThatDataIsLoadedProperlyForPositiveDelta` (`ConsultStatsCellTests.swift:22`)
- Terse action form: `testValidateEmail` (`PPEmailLoginViewModelTests.swift:137`), `testFetchSubscriptionList` (`PRESubscriptionListInteractorTests.swift:37`), `testGetDataSource` (`CampaignSummaryViewModelTests.swift:13`)
- No Swift backtick `func test("…")()`, no Swift Testing `@Test`.

### SUT declaration
- Almost always implicitly-unwrapped optionals (`!`) initialized in `setUp`: `viewController: PatientListViewController!` (`PatientListViewControllerTests.swift:14`), `interactor: PRESubscriptionListInteractor!` (`PRESubscriptionListInteractorTests.swift:27`)
- Sometimes default-initialized at declaration: `var vm = ReportsViewModel()` (`ReportsViewModelTests.swift:14`), `var viewModel = PRESubscriptionDetailsViewModel(ReachAPIMock.self)` (`PRESubscriptionDetailsViewModelTests.swift:13`), `lazy var vm = AppointmentListViewModel(delegate: nil, frcDelegate: nil)` (`AppointmentListVMTests.swift:15`)
- VC tests: storyboard-loaded inside `setUp` then `_ = viewController.view` triggers `viewDidLoad`: `PatientListViewControllerTests.swift:21-30`, `PPOTPTableViewControllerTests.swift:23-29` (comment: `// The One Weird Trick!`)

### Mocking — characterized patterns (no 3rd-party libs)

`grep` confirms **no Mockable, no Cuckoo, no Sourcery** anywhere in repo.

- **Pattern A — Boolean call-flag mocks (DOMINANT, 6/8+ files).** Hand-written class conforming to a protocol with `var <method>Called: Bool = false` that is flipped inside the method body. Used in VIP and VM tests.
  - Example: `PRESubscriptionListInteractorTests.swift:12-22` (`isDidFetchSubscriptionListCalled`)
  - Example: `EstablishmentPreviewInteractorTests.swift:13-34` (`isWorkerCalled`, `isPresenterCalled`)
  - Example: `CampaignFilterVMTest.swift:12-50` (9 separate `…Called` flags on one mock)
  - Naming: prefix `is…Called` or suffix `…Called` — both present, inconsistent.

- **Pattern B — Closure-binding (reactive) VM mocks.** `setupBindings()` on a mock VC assigns each `viewModel.onSomething = { [weak self] in self?.somethingCalled = true }`, then asserts the boolean.
  - Canonical: `PPEmailLoginViewModelTests.swift:28-56` — wires 7 closures, all flip booleans.
  - Same shape used in `ReportsViewModelTests.swift:30` (`vm.onRayReportsLoaded = { error in ... }`) inside the test body rather than a mock VC.

- **Pattern C — Protocol-injected API mocks** with **static state machine via enum** (singletons drive scenarios).
  - `LoginHelperMock.LoginStates` enum (`PPEmailLoginViewModelTests.swift:60-67`) plus `static var loginState` — each test sets `LoginHelperMock.loginState = .success` etc. (`PPEmailLoginViewModelTests.swift:160, 167, 195, 206`).
  - `ReachAPIMock` (`Reach/APIMock/ReachAPIMock.swift:12`) — protocol-conforming class with hard-coded JSON literal `static let responseList = """{…}"""`.

- **Pattern D — Subclass override of base mocks** (Fit/Consult/Ray). Base mocks live in `Mocks/Base*APIMock.swift` with empty stub methods; test files declare `class MockAPI: BaseFitAPIMock { override static func getDashboardInfo(...) }`.
  - `FitDashboardViewControllerTests.swift:15-25` — overrides one method, reads JSON from `TestUtils.getJSONfrom(file:)`.
  - Base: `Mocks/BaseFitAPIMock.swift:13-19` — `FitAPIType` conformance with `class func` no-op stubs.

- **Pattern E — In-memory CoreData via `DBManagerMock`** for Ray and anything DB-touching. Singleton swap in `setUp`:
  - `DBManager.sharedInstance = DBManagerMock()` (`AppointmentListVMTests.swift:24`, `PatientListViewControllerTests.swift:27`)
  - `DBManagerMock` (`Mocks/DBManagerMock.swift:13-44`) — full `DBManager` subclass that builds NSPersistentStoreCoordinator with `NSInMemoryStoreType`. Restored in `tearDown`.

- **Pattern F — `UserDefaultsMock` swap on `Utils`.** `Utils.userdefaults = UserDefaultsMock()` (`AppointmentListVMTests.swift:21-22`, `PatientListViewControllerTests.swift:24-25`) and restored to `UserDefaults.standard` in `tearDown` (`AppointmentListVMTests.swift:172-173`).

- **Pattern G — OHHTTPStubs network stubbing** for VMs that hit network directly. `stub(condition: hasPrefixBlock(<url>), response: jsonResponse(<file>.json))` (`ReportsViewModelTests.swift:18-20`). Helpers in `Utils/RequestStubberHelpers.swift:13-31` define `jsonResponse`, `errorResponse`, `hasPrefixBlock`, `hasEverythingBlock`. `HTTPStubs.removeAllStubs()` in `tearDown` (`ReportsViewModelTests.swift:25`).

- **No** recorded call **counts** observed; no XCTest fakes with parameter capture; no spy frameworks; no Mockable/Cuckoo macros.

### setUp / tearDown
- **All `override func setUp()` — no `throws`, no `setUpWithError` variant** (zero hits across the repo).
- Always begins with `super.setUp()`.
- `tearDown()` often omitted; when present, used to restore singletons (`DBManager`, `Utils.userdefaults`, `HTTPStubs.removeAllStubs()`).

### Async
- **No `async`/`await` in any test file** (zero `grep` hits).
- 8 of 87 files use `XCTestExpectation` (callback-based VMs and timing-sensitive VC tests). Example: `ReportsViewModelTests.swift:29` (`exp.fulfill()` inside `onRayReportsLoaded` callback). Example: `PatientListViewControllerTests.swift:106-112` (`DispatchQueue.main.asyncAfter` + `waitForExpectations(timeout: 5)`).
- Most VM tests are **synchronous** — they rely on mocks completing inline (the typical `LoginHelperMock.login` invokes the completion synchronously, `PPEmailLoginViewModelTests.swift:77-93`).

### Assertions
- **`XCTAssertTrue(... == ...)` is the dominant style** rather than `XCTAssertEqual`. See `PRESubscriptionDetailsViewModelTests.swift:22, 26-29` (10+ `XCTAssertTrue(viewModel.getX() == "y", "msg")`).
- Mixed with `XCTAssertEqual` in newer files: `AppointmentListVMTests.swift:42, 154, 163-166`, `ReportsViewModelTests.swift:36, 57, 124`.
- `XCTAssertNotNil`/`XCTAssertNil` for optionals, `XCTFail("...")` for unreachable paths.
- **Every assertion includes a descriptive message** — strong convention.

### Test data / fixtures
- **JSON files bundled with test target.** Loaded via `TestUtils.getJSONfrom(file: "editor-feedback-single")` (`FitEditorFeedbackModelTests.swift:24`) — implementation at `Utils/TestUtils.swift:13-24`.
- For OHHTTPStubs, JSON file referenced by name in `jsonResponse("RayReports.json")` — file resolved via `OHPathForFileInBundle` (`Utils/RequestStubberHelpers.swift:14`).
- Inline JSON literals: `ReachAPIMock` uses `static var responseList = """..."""` (`Reach/APIMock/ReachAPIMock.swift:13-53`).
- CoreData fixtures via `MockData()` helpers: `MockData().insertMockPractice(context: moc)` (`AppointmentListVMTests.swift:26`), `MockData().insertMockPatient(context: moc!)` (`PatientListViewControllerTests.swift:56`).

### Imports
- Order observed: `@testable import PractoBusiness` near top; `import XCTest` last; third-party (`SwiftyJSON`, `OHHTTPStubs`, `CoreData`, `Foundation`) interleaved. Despite SwiftLint `sorted_imports` rule, test files do **not** consistently alphabetize. Examples:
  - `@testable import PractoBusiness\nimport XCTest` (`PPEmailLoginViewModelTests.swift:9-10`)
  - `import CoreData\nimport Foundation\n@testable import PractoBusiness\nimport XCTest` — alphabetical (`AppointmentListVMTests.swift:9-12`)
  - `import SwiftyJSON\nimport XCTest\n\n@testable import PractoBusiness` — NOT alphabetical, `@testable` separated by blank line (`ConsultStatsCellTests.swift:9-12`, `FitEditorFeedbackModelTests.swift:9-12`)

### File headers
Universally present and uniform Xcode-generated block:
```
//
//  <FileName>.swift
//  PractoBusiness  (or PractoBusinessTests)
//
//  Created by <Author> on <DD/MM/YY>.
//  Copyright © <YYYY> Practo Technologies Private Limited. All rights reserved.
//
```
Examples: `PRESubscriptionListPresenterTests.swift:1-7`, `AppointmentListVMTests.swift:1-7`, `ConsultStatsCellTests.swift:1-7`. Aligns with the CLAUDE.md "File header must include the standard copyright block" rule.

### `final class` usage
- **`final class`: 51 declarations.** `class` (non-final): 17.
- Newer files / Auth / Profile-VIP / Fit lean `final`. Older Reach files still `class`.
- Mixed within same area — even within a single file: `PPEmailLoginViewControllerMock` is `final` but `PPEmailLoginViewModelTests` is plain `class` (`PPEmailLoginViewModelTests.swift:12, 116`). Not enforced.

## 3. Build deps
- **`Podfile` test deps** (entire test target): single line — `pod 'OHHTTPStubs/Swift'`. Lives inside `target 'PractoBusinessTests' do … inherit! :search_paths`.
- **SPM (`Package.swift`)**: not present in repo root — project is purely CocoaPods + XcodeGen.
- **Base test classes / utilities** (no abstract `BaseTestCase` exists — everything subclasses `XCTestCase` directly):
  - `Mocks/BaseAPIMock.swift:14` — `final class BaseAPIMock: APIType` (no-op networking)
  - `Mocks/BaseFitAPIMock.swift:13` — `class BaseFitAPIMock: FitAPIType` (open for override; non-final intentionally)
  - `Mocks/BaseConsultAPIMock.swift` (same pattern)
  - `Mocks/DBManagerMock.swift:13`
  - `Mocks/UserDefaultsMock.swift`
  - `Mocks/MockData.swift` (CoreData fixtures)
  - `Utils/TestUtils.swift` (JSON loader)
  - `Utils/RequestStubberHelpers.swift` (OHHTTPStubs sugar)
  - `Ray/RayAPIBaseMock.swift`, `Ray/Sync/RayAPISyncBaseMock.swift`
  - `Transactions/MockTransactionAPI.swift`

## 4. Source classifications
- **ViewModel** — naming `<Feature>ViewModel`. Protocol convention varies:
  - `<Feature>ViewModelProtocol` confirmed in source: `Authentication/.../PPEmailLoginViewModel.swift:24` (`protocol PPEmailLoginViewModelProtocol: AnyObject`), `Reach/.../PRESubscriptionDetailsViewModel.swift:18`.
  - Many VMs (older Ray/Transactions) have **no protocol** — instantiated directly: `AppointmentListViewModel(delegate:frcDelegate:)` (`AppointmentListVMTests.swift:15`), `ReportsViewModel()` (`ReportsViewModelTests.swift:14`).
- **ViewController** — UIKit, loaded via storyboard. Two routes:
  - Direct: `UIStoryboard(name: "AuthenticationFlow", bundle: .main).instantiateViewController(withIdentifier: "...")` (`PPOTPTableViewControllerTests.swift:23`, `PatientListViewControllerTests.swift:21`)
  - Helper: `Utils.loadViewController(PractoConstants.Storyboard.kFitStoryboard, vcIdentifier: ...)` (`FitDashboardViewControllerTests.swift`, 5+ Fit files)
- **Service / API client** — protocol-typed (`FitAPIType`, `ReachAPIType`, `ConsultAPIType`). Production injects concrete; tests inject `BaseFitAPIMock`/`ReachAPIMock`. Often passed as `Type.self` (Reach uses metatypes).
- **VIP (Coordinator/Router)** — Profile/L3 and Reach. Each module has Worker, Interactor (+Input/Output), Presenter (+Input/Output), Router. Tests mock each adjacent collaborator with a `*Mock` class implementing the corresponding `*Input/Output` protocol. Reference: `PRESubscriptionListPresenterTests.swift:12-54` mocks three collaborators in one file.
- **Model layer** — JSON-driven models with `init(from: JSON)` or `getArray(from:)` factories. Tested by loading bundled JSON. Example: `FitEditorFeedbackModelTests.swift`.
- **Helpers / Utilities** — `Utils/TestUtils.swift` (JSON loader + `Bundle.testBundle`), `Utils/RequestStubberHelpers.swift` (OHHTTPStubs DSL).

## 5. Direction of travel
- **Git history is blocked** in this sandbox (`git log` permission denied) and clone timestamps are uniform, so can't reliably rank "newest vs oldest."
- **Date-in-header heuristic** (created-by dates) shows: oldest visible 2016-11 (`ConsultStatsCellTests.swift:6` — Manjeet Singh, 08/11/16), span runs to 2018 (`CampaignSummaryViewModelTests.swift:5` — 15/02/18). No headers from 2019+ in sampled files — likely most tests are 2016-2018 vintage and have not been refactored.
- **Observable migration trends within the codebase (not necessarily test-side):**
  - Newer VMs (Auth `PPEmailLogin`, Reach `PRESubscriptionDetails`) ship with `…ViewModelProtocol`; older Ray VMs don't.
  - Newer files use `final class`, closure-binding mocks, and richer `Mocks/Base*APIMock` infrastructure. Older Reach/Consult files inline mock classes top-of-file.
  - No movement detected toward Swift Concurrency, Swift Testing, or any mocking library.

## 6. Style consistency
- **Varies by area + within-area variation.**
- Sub-styles by area:
  - **Reach (VIPER)** — older `class` (non-final) tests; three mocks inline at top of file (Presenter Output, Interactor Input, Router Input); boolean call flags `is…Called`.
  - **Profile/L3 (VIPER, newer)** — `final class`; mock Worker + mock Presenter Output; same flag style.
  - **Authentication (EmailLogin, MVVM with VM-protocol)** — closure-binding mock VC + static-enum state-machine helper mock.
  - **Ray (legacy MVC + CoreData VMs)** — heavy DBManagerMock + UserDefaultsMock singleton swap, `MockData()` helpers, lots of CoreData entity inserts.
  - **Fit / Consult** — `Bundle.main.loadNibNamed` for cells; subclass-override of `Base*APIMock` with JSON via `TestUtils.getJSONfrom`.
  - **Reports / Transactions** — OHHTTPStubs for end-to-end VM behavior; bundled JSON fixtures.
- Cross-cutting inconsistencies: file naming (`*Tests.swift` vs `*Test.swift`), `final` vs `class`, `XCTAssertTrue(==)` vs `XCTAssertEqual`, import sort order, `isFooCalled` vs `fooCalled`.

## 7. Honest gaps
- **No SwiftUI tests sampled** — `grep` returned zero `SwiftUI` references in any test file. Either the SwiftUI surfaces (mentioned in repo brief) are untested or live in a different target. Cannot characterize a SwiftUI test pattern from this repo.
- **No async/await tests sampled** — zero hits. The repo brief mentioning "async pattern" cannot be answered with a partner-ios native-Swift answer.
- **Git log access blocked** — could not rank by modification recency. "Direction of travel" inferred from header dates, which is a weak proxy (an old file could have been heavily edited last week).
- **Did not deep-sample Profile/L3 VIP** beyond `EstablishmentPreviewInteractorTests` — five other Profile files (Worker, Presenter, Controller, Configurator, MapVC) exist and may differ.
- **Sample skewed toward `*Tests.swift` files.** Did not deeply analyze the `Mocks/MockData.swift` or `BaseConsultAPIMock.swift` for shape; only confirmed they follow the `Base*APIMock` no-op-class pattern.
- Did not examine `Ray/Sync/SyncTests.swift` — its `RayAPIMultipleSyncMock` / `RayAPISyncSuccessMock` / `RayAPISync403Mock` family suggests a richer enum-state-of-the-world pattern that would inform an adapter, but didn't read.

### Recommended adapter shape (one-paragraph TL;DR)
For a `/devkit:cover` partner-ios adapter, generated tests should: file-header copyright block, `import XCTest` last, `@testable import PractoBusiness`, `final class <SUT>Tests: XCTestCase`, IUO-`!` properties initialized in `override func setUp()` (no `throws`), test method names `testCamelCase` (sentence form preferred), boolean-flag protocol mocks for collaborators (`is<Method>Called` style — match the file's existing convention), closure-binding for VM→VC callbacks, `XCTAssertEqual` with descriptive message strings, `DBManagerMock` + `UserDefaultsMock` swap for any CoreData/UserDefaults path, `BaseFitAPIMock`-style subclass-override for FitAPIType/ConsultAPIType/ReachAPIType collaborators, `OHHTTPStubs` only when the SUT truly hits Alamofire, and JSON fixtures via `TestUtils.getJSONfrom` with the file shipped in the test bundle. Skip Mockable/Cuckoo/Sourcery — they aren't used. Skip async/await — the repo is fully synchronous. Auto-detect VIP modules by the `<Feature>{Interactor,Presenter,Router,Worker}.swift` quartet and emit the canonical "mock each adjacent protocol with call-flags" template.
