# partner-droid Test Pattern Analysis

> Source: `general-purpose` agent run on local clone of `practo/partner-droid` (2026-05-19). Sampled 8+ test files across 3+ feature modules with `path:line` citations.

## 1. Test inventory
- **~58 unit test files** under `features/*/src/test/` + `app/src/test/` (excluding `node_modules`)
- **3 androidTest (instrumented)** files only: `app/.../CursorUtilsTest.java`, `DBUtilsTest.java`, `features/promo/.../ExampleInstrumentedTest.kt`
- **Roughly 60/40 Kotlin/Java** split (newer = Kotlin, older = Java)
- **Top 5 modules by test density:**
  1. `ray` (12 files: ViewModels, repos, utils, callerId helpers)
  2. `healthfeed` (12 files, all Java, all ViewModels)
  3. `reach` (12 files: 3 VMs Kotlin + 9 entity tests)
  4. `transactions` (11 files: VMs + entity tests)
  5. `medicine` (3 files, mixed Kotlin/Java)
- Most feature modules under `features/` have **zero tests** (account, consult, chats, profile, prescription, base, etc.)
- **Files sampled (8+):** `features/transactions/.../TransactionRepositoryTest.kt`, `features/transactions/.../TransactionDashboardViewModelTest.kt`, `features/medicine/.../MedicineDetailViewModelTest.java`, `features/medicine/.../MedicineSearchViewModelTest.kt`, `features/ray/.../SoapNoteRepositoryTest.kt`, `features/ray/.../CongratulationAdapterTest.kt`, `features/ray/.../utils/ErrorResponseHandlerTest.kt`, `features/healthfeed/.../HealthfeedDashboardViewModelTest.java`, `features/reach/.../ReachDashboardViewModelTest.kt`, `features/common-databinding/.../ValidationTest.kt`, `app/.../PractoAppsFlyerDeepLinkListenerTest.kt`, `features/healthfeed/.../HealthfeedWebViewClientTest.java`, `app/.../CursorUtilsTest.java` (instrumented).

## 2. Patterns (with citations)

### Class naming
- `<ProductionClass>Test` uniformly — Kotlin: `MedicineSearchViewModelTest.kt:39`; Java: `HealthfeedDashboardViewModelTest.java:52`. No `*Spec`/`Should` styles found.

### Method naming — diverges by language
- **Java**: `test<Verb><Subject>` camelCase. `HealthfeedDashboardViewModelTest.java:135` `testASuccessfulResponse`; `MedicineDetailViewModelTest.java:50` `testUiOnOpenDetail`. Often **alpha-prefixed (`testA`, `testB`, `testC`)** to enforce execution order with `@FixMethodOrder(MethodSorters.NAME_ASCENDING)` (`HealthfeedDashboardViewModelTest.java:51`).
- **Kotlin (older)**: same `testFooBar` pattern — `MedicineSearchViewModelTest.kt:79` `testHandleApiSuccess`.
- **Kotlin (older Kotlin BDD-ish)**: `verb_when_condition` with underscores — `ReachDashboardViewModelTest.kt:81` `getReachPracticeSubscription_withNoInternet`; `SoapNoteRepositoryTest.kt:33` `updateSoapNotes_Triggers_Dao_update`.
- **Kotlin (newest)**: backtick natural-language — `TransactionDashboardViewModelTest.kt:36` `` `should return empty list if campaigns is not initialised` `` and the most recently modified file `PractoAppsFlyerDeepLinkListenerTest.kt:16,26,36,46,55,61` is **entirely backtick**.

### @RunWith — heavy fragmentation
- `PowerMockRunner` — `MedicineSearchViewModelTest.kt:37`, `ReachDashboardViewModelTest.kt:34` — always paired with `@PrepareForTest` (`MedicineSearchViewModelTest.kt:38`, `ReachDashboardViewModelTest.kt:35`).
- `MockitoJUnitRunner` — `MedicineDetailViewModelTest.java:23`, `ValidationTest.kt:18`, `CongratulationAdapterTest.kt:18`, `HealthfeedDashboardViewModelTest.java:50` (uses **legacy `org.mockito.runners`** at `HealthfeedDashboardViewModelTest.java:25`, vs newer `org.mockito.junit` elsewhere).
- `JUnit4::class` — `TransactionDashboardViewModelTest.kt:15`, `TransactionRepositoryTest.kt:9`, `CursorUtilsTest.java:14`.
- `RobolectricTestRunner` — only 1 example, `ErrorResponseHandlerTest.kt:13`.
- **No runner at all** (manual mock construction) — `SoapNoteRepositoryTest.kt:17`, `PractoAppsFlyerDeepLinkListenerTest.kt:13`.
- No `AndroidJUnit4`/Compose UI test runner found.

### Mock library — **mixed within a single file is the norm**
- **Pattern 1: `Mockito.mock(X::class.java)` inline-field (Kotlin)** — `TransactionDashboardViewModelTest.kt:20-25`, `ReachDashboardViewModelTest.kt:39-41`. Used in ~6 sampled files.
- **Pattern 2: `mockito-kotlin` `mock()`/`whenever()`/`verify()`** — `nhaarman.mockitokotlin2` package: `SoapNoteRepositoryTest.kt:6-8`, `MedicineSearchViewModelTest.kt:6-9`. Also older `nhaarman.mockito_kotlin` (no `2`) at `ValidationTest.kt:5-6`.
- **Pattern 3: `@Mock lateinit var` / `@Mock private val`** — `MedicineSearchViewModelTest.kt:46-53`, `MedicineDetailViewModelTest.java:28-33`, `HealthfeedDashboardViewModelTest.java:72-89`, `CongratulationAdapterTest.kt:23-27`. Java uses `@Mock`, Kotlin uses `@Mock lateinit var`. Requires `MockitoJUnitRunner` or `PowerMockRunner`.
- **Pattern 4: MockK for statics/objects, layered on top of Mockito** — `MedicineSearchViewModelTest.kt:18-22,61-73` uses `mockkStatic(FirebaseUtils::class)`, `mockkObject(MedicineEventTracker)` alongside Mockito `@Mock` lateinit fields. `ReachDashboardViewModelTest.kt:17-19,55-65` uses `mockkObject(ReachEventTracker.PracticeImpression)` alongside `Mockito.mock(...)`. **MockK is used selectively for `object` singletons + static methods, never as a full replacement.**
- **No pure-MockK file found** in the sample. No Mockito 3 `mockStatic` usage either.

### Static / object mocking
- Statics: `mockkStatic(FirebaseUtils::class)` — `MedicineSearchViewModelTest.kt:61`.
- Singletons: `mockkObject(MedicineEventTracker)` — `MedicineSearchViewModelTest.kt:67`; `mockkObject(ReachEventTracker.PracticeImpression)` — `ReachDashboardViewModelTest.kt:55`.
- PowerMock `@PrepareForTest` is declared but mostly **only to pin class for `PowerMockRunner`**, not for actual `PowerMockito.mockStatic` calls in the sampled files — i.e., `PowerMockRunner` here is mostly inertia/legacy.

### setUp
- **`@Before fun setUp()`** — `TransactionRepositoryTest.kt:12-15`, `ReachDashboardViewModelTest.kt:48-49`, `CongratulationAdapterTest.kt:30`.
- **`@Before fun setup()`** (no caps) — `TransactionDashboardViewModelTest.kt:28`, `SoapNoteRepositoryTest.kt:27`.
- **`@Before fun beforeEachTest()`** — `MedicineSearchViewModelTest.kt:56`, `MedicineDetailViewModelTest.java:36`.
- **`@Before public void setupXxx()`** (named after SUT) — `HealthfeedDashboardViewModelTest.java:97` `setupHealthfeedDashboardViewModel`. Naming is **not standardized**.

### InstantTaskExecutorRule
- Present whenever LiveData touched. Two declaration styles:
  - **Kotlin `@get:Rule val`** — `SoapNoteRepositoryTest.kt:23-24`.
  - **Kotlin `@Rule @JvmField var/val`** — `MedicineSearchViewModelTest.kt:43-45`, `ReachDashboardViewModelTest.kt:44-46`.

### Coroutines / RxJava test infra
- `coroutinesTest` is in dependencies (`features/transactions/build.gradle:92`, `features/ray/build.gradle:151`) but **no `runTest`/`TestCoroutineDispatcher` usage in sampled files**.
- **RxJava 2 is dominant**: `Single.just(expectedResult)` — `ReachDashboardViewModelTest.kt:99`; `.test().onComplete()` — `SoapNoteRepositoryTest.kt:35`; `test()?.assertSubscribed()` / `assertValue()` — `ReachDashboardViewModelTest.kt:108-110`. **No `TestScheduler` found** — direct subscription assertion only.

### Assertions
- **Three styles coexist:**
  - **JUnit `assertEquals` / `assertTrue` / `assertFalse`** — most common — `MedicineDetailViewModelTest.java:51`, `MedicineSearchViewModelTest.kt:24-27`, `CongratulationAdapterTest.kt:8`.
  - **Google Truth `Truth.assertThat(...).isEqualTo()`** — `ReachDashboardViewModelTest.kt:124-125`, `ErrorResponseHandlerTest.kt:21`, `SoapNoteRepositoryTest.kt:45`. Used in newer Kotlin files.
  - **Custom infix DSL** `result isEqualTo 0` / `isNotNull()` — `ReachDashboardViewModelTest.kt:75-77` via `reach.utils.extensions.*`.
- **No AssertK, Kotest, or Hamcrest matcher usage** found, though hamcrest is on the classpath in some modules.

### Test data / fixtures
- **`companion object`/static String constants** for test inputs — `CongratulationAdapterTest.kt:51-55`, `HealthfeedDashboardViewModelTest.java:54-70`.
- **Shared `BaseTest` helper class** — `MedicineBaseTest.java` (loads JSON from `/apiresponse/medicine/` test resources via `getResource` at line 29).
- **Builder/factory functions in a `utils` test package** — `reach.utils.createMetaData()`, `createReachPractice()`, `createReachSubscriptionClubbed()` — used at `ReachDashboardViewModelTest.kt:11-13,98,192`. No MockK `relaxed = true` "fake everything" pattern.

### Imports
- `org.junit.{Before,Test,Rule}` + `org.junit.runner.RunWith` ubiquitous.
- Kotlin files import individual `assertX` (`import org.junit.Assert.assertEquals`) rather than wildcards, except `CongratulationAdapterTest.kt:8` (`org.junit.Assert.*`).
- `com.nhaarman.mockitokotlin2.*` (with `2`) in newer files; `com.nhaarman.mockito_kotlin.*` (with underscore — older lib) at `ValidationTest.kt:5`.

### File headers
- **No file-level header or license/copyright block** in any sampled file. Some have Javadoc on test methods describing `When/Do` behaviour (`MedicineDetailViewModelTest.java:45-48,59-62,76-79`); KDoc only on `PractoAppsFlyerDeepLinkListenerTest.kt:8-12` explaining a regression context.

## 3. Build deps
- **Test deps declared per-feature** in each module's `build.gradle`, pulled from `buildSrc/.../Config.kt` `TestLibraries` object (`Config.kt:322-352`).
- **Versions** (`Config.kt:101-113`): JUnit 4.12, Mockito 3.6.28, mockito-kotlin 2.2.0 (nhaarman), PowerMock 2.0.9, MockK 1.10.2, Truth 0.36, Robolectric 3.5.1 (very old), espresso 3.1.0, uiautomator 2.2.0, arch core-testing 2.1.0.
- **Per-module variations:**
  - `ray/build.gradle:140-152` — full stack incl. PowerMock + MockK + Robolectric + coroutinesTest.
  - `transactions/build.gradle:86-93` — **no PowerMock, no MockK** (mockitoKotlin + Truth + coroutinesTest only).
  - `medicine/build.gradle:65-74` — Mockito + PowerMock + MockK + Truth + archCoreTesting; no coroutinesTest.
  - `reach/build.gradle:93-103` — Mockito + PowerMock + MockK + Truth + archCoreTesting + coroutinesTest; **no Robolectric**.
  - `healthfeed/build.gradle:59-65+` — Mockito + PowerMock; **no MockK**.
- **JaCoCo**: configured **only in root `build.gradle:44`** (`org.jacoco:org.jacoco.core:0.8.7`) and **`app/build.gradle:5,19,416-449`** — task `jacocoTestReport` depends on `testCiDebugUnitTest`. **No per-feature JaCoCo wiring** — root drives it.
- `testOptions { unitTests { returnDefaultValues = true } }` set in `transactions/build.gradle:52-56`, common pattern when Android framework classes appear in unit tests.

## 4. Source classifications
- **ViewModel** — `*ViewModel.kt`/`.java` — most tested type (`MedicineDetailViewModel`, `HealthfeedDashboardViewModel`, `ReachDashboardViewModel`, etc.). Standard `ViewModel` extension with `LiveData`/`ObservableField` data-binding fields.
- **Repository** — `*Repository.kt` + paired `*RepositoryImpl` — `SoapNoteRepository`/`SoapNoteRepositoryImpl` (`SoapNoteRepositoryTest.kt:21`), `TransactionRepository`, `ReachRepository`.
- **DataSource** — `*DataSource` (`LanguageDataSourceTest.kt`, `SoapNoteDataSource`) — sits between Repository and Room/Retrofit.
- **Adapter (RecyclerView)** — `*Adapter` — `CongratulationAdapter` (tested).
- **Entity / data class** — `*` plain Kotlin data class — heavily tested in `reach/data/entity/*` and `transactions/data/entity/*` (9+10 files).
- **Util / Helper** — `*Utils`/`*Helper`/`*Handler` — `ErrorResponseHandler`, `IoApprovalUtils`, `CallerIdHelper`, `CursorUtils`.
- **WebView clients** — `HealthfeedWebViewClient`, `HealthfeedWebChromeClient`.
- **Listener / Delegate** — `PractoAppsFlyerDeepLinkListener` (logic extracted to companion-object pure function for testability — see KDoc at `PractoAppsFlyerDeepLinkListenerTest.kt:8-12`), `NoteViewModelDelegate`.
- **Retrofit interface** — `TransactionApi` (tested in `TransactionApiTest.kt`).
- **Compose @Composable / use-cases / mappers / interactors** — **none tested.** No Clean-Arch UseCase layer evident.
- **Fragment / Activity tests** — none.

## 5. Direction of travel
Newest test (only one newer than `CLAUDE.md` 2026-03-06): **`PractoAppsFlyerDeepLinkListenerTest.kt`** (`app/src/test/java/com/practo/droid/analytics/`). Signals:
- **Backtick natural-language method names** (`PractoAppsFlyerDeepLinkListenerTest.kt:16,26,36,46`).
- **No `@RunWith` at all** — pure-Kotlin function tests.
- **No mocking library** — author extracted a pure `pickDeeplink()` function specifically to dodge "AppsFlyer SDK final classes that this project's test setup can't mock" (`PractoAppsFlyerDeepLinkListenerTest.kt:8-11`).
- **JUnit asserts only** (no Truth).
- KDoc explicitly explains why the test exists (regression).

Next-newest (`TransactionDashboardViewModelTest.kt`): also backtick naming, plain `JUnit4::class` runner, `Mockito.mock(...)` field init.

**Migration evidence:**
- **PowerMock is being avoided in new code.** Newer files use either pure-function tests or `JUnit4`/`MockitoJUnitRunner`. `transactions/build.gradle` deliberately omits PowerMock.
- **Backtick method names ARE arriving** in 2025–2026 tests.
- **No Java → Kotlin test conversions found**; Java tests are frozen, new files are Kotlin.
- **No MockK-only file** yet — MockK still added on-top-of Mockito for `object`s.
- **No move to coroutines-test** despite `coroutinesTest` dep being added — production code in tested files is still RxJava 2.

## 6. Style consistency
**Varies by module + by language + by author**. Sub-styles:

| Style | Where | Signal |
|---|---|---|
| **A. Legacy Java-VM** | healthfeed, medicine (Java), older app/ | `MockitoJUnitRunner` + `@FixMethodOrder(NAME_ASCENDING)` + `testA/B/C` method names + heavy `@Captor`/`ArgumentCaptor` + JUnit asserts |
| **B. PowerMock-Kotlin hybrid** | medicine (Kotlin), reach, ray | `@RunWith(PowerMockRunner)` + `@PrepareForTest` + `@Mock lateinit var` + Mockito-kotlin `whenever` + MockK `mockkStatic`/`mockkObject` for singletons + Truth or JUnit asserts mixed |
| **C. Plain JUnit4 Kotlin** | transactions, reach repos, ray repos | `@RunWith(JUnit4::class)` or no runner + `Mockito.mock(X::class.java)` field init + `mockito-kotlin` + Truth + RxJava `.test()` |
| **D. New pure-function** | app/analytics | No runner, no mocks, backtick names, JUnit asserts |

Java vs Kotlin diverge sharply: Java uses positional `mContext`/`mResources` Hungarian, alpha-prefixed methods, `ArgumentCaptor` everywhere. Kotlin uses idiomatic `mock<X>()`, infix DSLs, Truth.

## 7. Honest gaps
- **Only 1 sample for "newest direction"** (`PractoAppsFlyerDeepLinkListenerTest.kt`) — generalization risky. The TransactionDashboard backtick file may share that author.
- **No Compose UI test, no `@HiltAndroidTest`, no `MainCoroutineRule`, no `Turbine`, no Robolectric Compose** found in sample. `Robolectric 3.5.1` is so old that adding Compose-screen tests would require a major upgrade.
- `coroutinesTest` is on the classpath but **zero `runTest`/`runBlocking` invocations** in sampled files. Either suspend code is untested or non-sampled module.
- **No coverage-tooling-per-module config** — JaCoCo only at `app` level. Adapter must not assume `jacocoTestReport` runs per feature.
- **Recency proxy via `-newer CLAUDE.md`** found only one file; git history would give better signal but didn't run git here.
- **`ExampleUnitTest.kt` / `ExampleInstrumentedTest.kt`** in `promo` are AS template stubs, not real signal — `promo` effectively has 0 real tests.
- `androidTest` is essentially abandoned: 3 files total across the entire repo, all under `app/`. The adapter should not target instrumented tests as a default output.

**Recommendation for `/devkit:cover` adapter default:** emit **Style C (Plain JUnit4 Kotlin)** for new Kotlin sources, **with optional Style D (no-runner, backticks)** for pure-function targets; reuse `mockito-kotlin` (`com.nhaarman.mockitokotlin2.*`) + `Truth` + `InstantTaskExecutorRule` (`@Rule @JvmField val` form for max compatibility). Reach for MockK **only** when the target imports a Kotlin `object`/companion or calls a top-level `JvmStatic`. **Do not emit PowerMock**; flag any target that seems to need it as `needs-human`. For Java sources, mirror Style A but skip the `@FixMethodOrder` + alpha-prefix idiom — it's legacy. Pick library deps based on what each module's `build.gradle` already declares — adapter must read the module's `testImplementation` list before generating imports.
