# fabric-droid Test Pattern Analysis

> Source: `general-purpose` agent run on local clone of `practo/fabric-droid` (2026-05-19). Sampled 9+ test files across 5+ feature modules with `path:line` citations.

## 1. Test inventory

- Total: **155** test files under `src/test/` — **153 Kotlin + 2 Java**.
- **androidTest**: 1 file only (`abdm/.../ExampleInstrumentedTest.kt`) — instrumented tests are essentially absent in this repo.
- **Java tests**: both are in `order/medicineinfo` under app-root `src/test/`. The rest of the repo (~99%) is Kotlin.
- Modules with tests (top 5 by file count, approximate from listing): **app root `src/test/`** (~30), **consult** (15), **core** (~13), **payments** (15), **profile-feedback** (~7); plus search, accounts, controller, config-fields, plus, provider-profile, home, consult, chats, order, appointments, healthfeed, etc.
- **Files sampled (16):**
  - `payments/src/test/java/com/practo/payments/paytm/viewmodel/PaytmViewModelTest.kt`
  - `consult/src/test/java/com/practo/fabric/module/consult/home/viewmodel/ConsultHomeViewModelTest.kt`
  - `consult/src/test/java/com/practo/fabric/module/consult/home/data/ConsultHomeRepositoryTest.kt`
  - `accounts/src/test/java/com/practo/accounts/data/AccountsRepositoryImplTest.kt`
  - `accounts/src/test/java/com/practo/accounts/whatsapp/WhatsAppConsentViewModelTest.kt`
  - `core/src/test/java/com/practo/fabric/core/extensions/StringsHelperTest.kt`
  - `core/src/test/java/com/practo/fabric/core/utils/AppPermissionUtilsKtTest.kt`
  - `network/src/test/java/com/practo/fabric/network/RetryInterceptorTest.kt`
  - `provider-profile/src/test/java/com/practo/provider/profile/data/source/MediaListingPagingDataSourceTest.kt`
  - `payments/src/test/java/com/practo/payments/paytm/data/PaytmRepositoryTest.kt`
  - `src/test/java/com/practo/fabric/home/aurora/MainActivityViewModelTest.kt`
  - `src/test/java/com/practo/fabric/home/aurora/ui/MainViewModelTest.kt`
  - `src/test/java/com/practo/fabric/module/order/medicineinfo/MedicineInfoViewModelTest.java` (Java)
  - `src/test/java/com/practo/fabric/deeplink/ProfileDeepLinkHandlerTest.kt`
  - `payments/src/test/java/com/practo/payments/viewmodels/PaymentOptionsViewModelTest.kt`
  - `core/src/test/java/com/practo/fabric/utils/PowerMockRobolectricTest.kt`

## 2. Patterns

### Test class naming
Always `<ClassUnderTest>Test`. Examples: `PaytmViewModelTest.kt:33`, `ConsultHomeRepositoryTest.kt:23`, `RetryInterceptorTest.kt:16`. Two Kt-suffix variants for top-level Kotlin extension files: `AppPermissionUtilsKtTest.kt:10`, `NavItemsHelperTest.kt`.

### Method naming — **MIXED, splits across two clear styles**
- **Style A (backtick sentence)** — dominant in newer code: `ConsultHomeRepositoryTest.kt:41` ``fun `should call predictProblemAreas method of api with correct arguments when search of repository is called`()``; `MainActivityViewModelTest.kt:147` ``fun `should return menu size equal to 11 when rx dx are disabled`()``; `RetryInterceptorTest.kt:49` ``fun `GET retries on 500 and succeeds`()``; `AppPermissionUtilsKtTest.kt:32` ``fun `Test rational message for empty list`()``.
- **Style B (underscore method_Behaviour)** — also common: `PaytmViewModelTest.kt:70` `fun payableAmount_withoutCredits()`; `:128` `fun hasEnoughBalance_withInsufficentBalance()`; `AccountsRepositoryImplTest.kt:22` `fun clear_withUseBackupTrue()`; `StringsHelperTest.kt:12` `fun getYearFromValidString_shouldReturnYear()`.
- **Java tests**: `testXxx_yyy` only — `MedicineInfoViewModelTest.java:92` `public void testGetEnabledDrugs_GetNonEmtpyArrayList()`, `:112` `testCartDrugSize_return0WhenNull`. CLAUDE.md documents this divergence: "`methodNamePreconditionExpectedBehaviour` or backtick strings for Kotlin".

The **same file mixes both styles** (`PaytmViewModelTest.kt` uses Style B; `AccountsRepositoryImplTest.kt:22` uses Style B alongside `:32` Style A). No project-wide enforcement.

### @RunWith
- **Default**: `@RunWith(JUnit4::class)` — `PaytmViewModelTest.kt:32`, `ConsultHomeViewModelTest.kt:17`, `MediaListingPagingDataSourceTest.kt:32`, `MainActivityViewModelTest.kt:34`, `StringsHelperTest.kt:8`. ~all sampled Kotlin tests.
- **`@RunWith(RobolectricTestRunner::class)`** when Android `Uri`/Context/parser is hit — `ProfileDeepLinkHandlerTest.kt:20`, `PowerMockRobolectricTest.kt:12`. ~17 files total (grep hit).
- **No `@RunWith` at all** in a few — `RetryInterceptorTest.kt:16` (pure OkHttp/MockWebServer), `WhatsAppConsentViewModelTest.kt:20`, `AppPermissionUtilsKtTest.kt:10`. JUnit's default runner is fine.
- **MockitoJUnitRunner / AndroidJUnit4 / PowerMockRunner**: not seen. PowerMock is wired via a `@Rule` (PowerMockRule), not the runner — `PowerMockRobolectricTest.kt:17`.
- **`@PrepareForTest`**: no hits anywhere — repo uses MockK or `Mockito.mockStatic` instead of full PowerMock for statics.

### Mock library — characterize each pattern
- **mockito-kotlin (Nhaarman fork, `com.nhaarman.mockitokotlin2`)** — primary, used in **majority** of files. Imports: `com.nhaarman.mockitokotlin2.mock/whenever/verify/doReturn` — `PaytmViewModelTest.kt:9-12`, `ConsultHomeRepositoryTest.kt:5-10`, `AccountsRepositoryImplTest.kt:5-7`, `MediaListingPagingDataSourceTest.kt:6-9`. Pinned at `2.2.0` in `build.gradle:194` (very old, predates Mockito-Kotlin renaming to `org.mockito.kotlin`).
- **MockK** — used in 3 files for **specific** needs that mockito-kotlin can't do: `mockkStatic` for top-level Kotlin extension functions and Kotlin `object` mocking. Examples: `PaymentOptionsViewModelTest.kt:36-38, 80-90` (`mockkStatic("com.practo.fabric.core.extensions.ApplicationKt")`); `ProfileDeepLinkHandlerTest.kt:11-13, 27-31` (`mockkStatic(LogUtils::class)`). MockK and mockito-kotlin coexist in same file.
- **Plain Mockito Java** — only in the 2 Java tests: `MedicineInfoViewModelTest.java:23-26` (`@Mock`, `MockitoAnnotations.initMocks(this)`).
- **PowerMock** — declared as a dep (`build.gradle:201-202, 706-707`) but the only actual use in `src/test/` is the abstract base class `PowerMockRobolectricTest.kt:17` (`PowerMockRule`). No `@PrepareForTest` usage found. Effectively dead/legacy.

### Static / object mocking
- **`Mockito.mockStatic` (Mockito 3.12.4 inline mock-maker)** — modern preferred way for static Java methods: `MediaListingPagingDataSourceTest.kt:47-49, 55-57, 67-72` mocks `LogUtils`, `ApiErrorHandler`, `ErrorScreenTracker`. Same pattern in `PaymentOptionsViewModelTest.kt:50, 69-70`. Required `mockito-extensions/org.mockito.plugins.MockMaker` resource — confirmed at `provider-profile/src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker` containing `mock-maker-inline` (8 modules have this).
- **`mockkStatic("...Kt")`** — for top-level Kotlin functions: `PaymentOptionsViewModelTest.kt:80, 86`.
- **No `mockkObject`** found in sampled files.

### setUp pattern
Two patterns coexist:
- **Top-level vals + inline `mock<X>()`** (most common in newer Kotlin) — `PaytmViewModelTest.kt:39-46`, `ConsultHomeRepositoryTest.kt:25-38` (no `@Before` at all — repository is constructed at field init).
- **`@Before fun setUp()` / `setup()`** when stubbing requires it — `PaytmViewModelTest.kt:48-62`, `MediaListingPagingDataSourceTest.kt:53-65`, `RetryInterceptorTest.kt:28-37`, `MainActivityViewModelTest.kt:93-144` (a 50-line setup is the outlier). Java uses `setUp()` + `MockitoAnnotations.initMocks(this)` — `MedicineInfoViewModelTest.java:63-89`.
- `@After fun tearDown()` only when state must be reset: `PaytmViewModelTest.kt:64-67` resets `Dispatchers`, `MediaListingPagingDataSourceTest.kt:67-72` closes `MockedStatic`, `ProfileDeepLinkHandlerTest.kt:33-36` unmocks static, `RetryInterceptorTest.kt:39-42` shuts down `MockWebServer`.

### InstantTaskExecutorRule
Present in every ViewModel test that touches LiveData (still the dominant ViewModel observable type despite CLAUDE.md preferring StateFlow). Declared two ways:
- `@Rule @JvmField val instantTaskExecutorRule = InstantTaskExecutorRule()` — `PaytmViewModelTest.kt:35-37`, `MainActivityViewModelTest.kt:88-90`, `MainViewModelTest.kt:45-47`.
- `@get:Rule val instantExecutorRule = InstantTaskExecutorRule()` — `ConsultHomeViewModelTest.kt:20-21`, `OrderServiceabilityViewModelTest.kt:30-31`, `WhatsAppConsentViewModelTest.kt:22-23`.

Variable name itself varies: `instantTaskExecutorRule` / `instantExecutorRule` / `rule`.

### Coroutines / RxJava test infra
- **Coroutines test** is the current path. Multiple co-existing recipes:
  - `runTest(testDispatcher)` + `StandardTestDispatcher()` + `Dispatchers.setMain/resetMain` — `PaytmViewModelTest.kt:46, 50, 66, 84` (per-test `runTest`); `MediaListingPagingDataSourceTest.kt:77` (top-level `runTest {}`).
  - `TestScope(testDispatcher).runTest { ... }` — `PaytmRepositoryTest.kt:21-22, 37`.
  - `runBlocking` — older style, still used: `ConsultHomeRepositoryTest.kt:45, 55, 72`, `WhatsAppConsentViewModelTest.kt:83`.
  - **Shared `TestCoroutinesRule`** in `test/src/main/java/com/practo/fabric/test/coroutines/TestCoroutinesRule.kt:15-34` — manages `Dispatchers.setMain` lifecycle + exposes `runBlockingTest`. Used in `WhatsAppConsentViewModelTest.kt:25-26, 66`.
  - **Per-module `MainCoroutineRule`** — `OrderServiceabilityViewModelTest.kt:12, 35-38` references `com.practo.fabric.module.order.MainCoroutineRule`. Duplicate of the shared one.
- **RxJava** still alive in legacy: `OffersRepositoryImplTest.kt:11-12` imports `Single`, `Maybe`; `getTestScheduler()` from shared utils swaps RX schedulers to `Schedulers.trampoline()` (`TestUtils.kt:41-54`). Used at `PaytmViewModelTest.kt:54`.
- **No `TestObserver`** sightings in samples.

### Assertions
- **Google Truth `assertThat`** is the standard: `StringsHelperTest.kt:3, 21`, `MediaListingPagingDataSourceTest.kt:5, 100`, `RetryInterceptorTest.kt:4, 57`, `AppPermissionUtilsKtTest.kt:5, 37`.
- **Custom infix `isEqualTo`** from shared `test` module (`TestUtils.kt:21-23`) is heavily used in payments ViewModel tests: `PaytmViewModelTest.kt:73, 80, 90, 109` (`viewModel.payableAmount.value isEqualTo 100.00`).
- **JUnit `Assert.assertEquals` / `assertNotNull`** — only in Java tests: `MedicineInfoViewModelTest.java:107-108`.
- **No AssertK, Kotest, Hamcrest direct use** in tests (hamcrest pulled in transitively via JUnit).

### Test data / fixtures
- **Private helper functions** at the bottom of the test class — most common: `PaytmViewModelTest.kt:360-419` (`paymentRequest()`, `paymentResponse()`, `otpResponse()`, `saveGatewayResponse()`); `MedicineInfoViewModelTest.java:242-305` (`getSomeRandomDrugs()`, `getResponseWithTwoDrugs()`).
- **Dedicated `StubFactory` object** — emerging for shared cross-test reuse: `payments/src/test/java/com/practo/payments/viewmodels/PaymentStubFactory.kt`, imported at `PaymentOptionsViewModelTest.kt:30-35`.
- **Dedicated `TestHelper` object** for constants/JSON — `consult/src/test/java/com/practo/fabric/module/consult/home/utils/ConsultTestHelper.kt`, used at `ConsultHomeRepositoryTest.kt:15, 63-79` (`ConsultTestHelper.ERROR_SECTION_JSON`, `ERROR_SECTION`).
- **JSON fixtures on disk** under `src/test/resources/api-response/` — confirmed in `plus/src/test/resources/api-response/` (planHome.json, usageWithOwner.json, etc.) and `controller/src/test/resources/attributions.json`. Matches the testing doc claim in `CLAUDE.md`.
- **`companion object` constants** — `MediaListingPagingDataSourceTest.kt:35-38` (`TEST_URL`, `PARENT_SOURCE`); `AppPermissionUtilsKtTest.kt:12-21`; `PaytmRepositoryTest.kt:24-26` (`PROFILE_TOKEN`).

### Imports
- `com.nhaarman.mockitokotlin2.*` (explicit imports per symbol, never wildcards) — `PaytmViewModelTest.kt:9-12`.
- `com.google.common.truth.Truth.assertThat` — `StringsHelperTest.kt:3`.
- `com.practo.fabric.test.*` — shared helpers (`getTestScheduler`, `isEqualTo`, `mock<T>`) — `PaytmViewModelTest.kt:15-16`.
- Wildcards rare; only seen `import org.junit.*` in `OrderServiceabilityViewModelTest.kt:19`.

### File headers
**None of the sampled files** have a copyright / license header. Some carry a one-line KDoc on the abstract base: `PowerMockRobolectricTest.kt:9-11` (`"You can use Powermock together with Robolectric."`). No author tags.

## 3. Build deps

**Root `build.gradle` versions (lines 67, 190-205)**: junit 4.13.2 · mockito-core 3.12.4 · mockito-inline 3.12.4 · **mockito-kotlin 2.2.0 (Nhaarman fork — old)** · Truth 1.1.3 · MockK 1.13.13 · PowerMock 2.0.9 · Robolectric 4.7.3 · `androidx.test.ext:junit-ktx:1.1.3` · `kotlinx-coroutines-test`.

**Per-module test deps (uniform block)** at e.g. `payments.gradle:172-184`, `provider-profile.gradle:133-142`: `:test` project + junit + mockitoCore + mockitoInline + mockitoKotlin + archCoreTest + googleTruth + mockk + powermock(MockitoApi+Junit4) + robolectric + coroutinesTest. Variants:
- `network.gradle:73-75` is **leaner**: just junit + googleTruth + **mockWebServer** (it's an OkHttp test).
- The `app` (root) test block at `build.gradle:699-710` adds `powermockJunit4` too.
- 8 modules ship `src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker` containing `mock-maker-inline` — required for `Mockito.mockStatic` to work.

**JaCoCo**: `jacoco.gradle:1, 7` — `apply plugin: 'jacoco'`, single `jacocoTestReport` task wired to `jacoco/testProductionDebugUnitTest.exec` (line 34). No minimum coverage threshold (matches CLAUDE.md).

## 4. Source classifications observed

- **ViewModel** — `<Name>ViewModel`, used directly with LiveData + Coroutines. Two flavors:
  - Hilt-style with `@Inject constructor` (newer; CLAUDE.md states `@HiltViewModel` is preferred). But test files instantiate manually — `MainViewModelTest.kt`, `MainActivityViewModelTest.kt:133-143`.
  - Constructor-injected non-Hilt: `PaytmViewModelTest.kt:52-55`.
- **Repository** — `<Name>Repository` / `<Name>RepositoryImpl`. Sometimes pure DI-friendly class (`ConsultHomeRepository`), sometimes interface + impl (`AccountsRepositoryImpl`). Returns `suspend` results or RxJava `Single/Maybe` in legacy.
- **PagingSource / DataSource** — `<Name>PagingDataSource` extending `PagingSource<Int, T>`: `MediaListingPagingDataSourceTest.kt`. Three of these in `provider-profile`.
- **Interceptor** (OkHttp) — `RetryInterceptor` tested with `MockWebServer`.
- **Top-level extension util `*Kt`** — tested as `<Name>KtTest` when extension is on a stdlib type: `AppPermissionUtilsKtTest`, `StringsHelperTest`, `UriExtensionsTest`, `NumberExtensionsTest`.
- **Deep-link handler** — `<Name>DeepLinkHandler`, requires Robolectric for `Uri.parse`.
- **Models / response data classes** — many `*Test.kt` files (`SectionTest`, `VirtualNumberTest`, `PhonePeResponseTest`, `PaymentBaseResponseTest`) — pure POJO/data-class tests, often verify Gson/Moshi parsing.
- **Helper objects** — `*Helper`, `*Utils`, `*AbTestUtils`.
- **UseCase / Interactor / Mapper / Adapter / Compose UI / Fragment / Activity tests** — **none found** in sampling. Repo is Repository-direct-from-ViewModel; no Clean-Arch use-case layer is exercised by tests. No `ComposeTestRule` / `createComposeRule` / `setContent` matches across all `*Test.kt`.

## 5. Direction of travel

Git was blocked in this environment, so can't pull a true commit-ordered diff. Three indirect signals point to the trend anyway:

- **Newest code** (CLAUDE.md says: "Preferred: Coroutines + StateFlow… migrate when touching") → newest tests use `runTest(testDispatcher)` + `StandardTestDispatcher` (`PaytmViewModelTest.kt:46, 84`, `MediaListingPagingDataSourceTest.kt:77`) and `Mockito.mockStatic` (`MediaListingPagingDataSourceTest.kt:55-57`).
- **Mid-era**: `runBlocking { ... }` inside `@Test` (`ConsultHomeRepositoryTest.kt:45`, `AccountsRepositoryImplTest.kt:22` — Style B method names).
- **Oldest**: `MedicineInfoViewModelTest.java` (the only legacy Java test, RxJava `SingleObserver`, `MockitoAnnotations.initMocks`, `testXxx_yyy` names).
- **Backtick-named methods are clearly preferred** in newer Kotlin code: `RetryInterceptorTest.kt` (an entirely new test for a new feature) is 100% backticks. `MediaListingPagingDataSourceTest.kt` is 100% backticks. Mixed-style files tend to be older.
- **MockK adoption is narrow and surgical** — `PowerMock` is functionally retired (1 abstract base class, 0 concrete consumers in `src/test/`). `Mockito.mockStatic` won the static-mocking turf war.

## 6. Style consistency

**Varies meaningfully** — both by module and within-file.

| Axis | Variants seen |
|---|---|
| Method naming | backtick sentences / underscore `method_Behaviour` / `testXxx_yyy` Java |
| Rule declaration | `@Rule @JvmField val` vs `@get:Rule val` |
| setUp | top-level inline `mock<X>()` vs `@Before` block vs Java `MockitoAnnotations.initMocks` |
| Coroutine main dispatcher | `TestCoroutinesRule` (shared) vs per-test `Dispatchers.setMain/resetMain` vs per-module `MainCoroutineRule` |
| RX scheduler swap | shared `getTestScheduler()` (`TestUtils.kt:41`) vs nothing |
| Static mocking | `Mockito.mockStatic` (newer) vs `mockkStatic` (Kotlin extensions only) |
| Assertions | `Truth.assertThat` vs custom infix `isEqualTo` (same file mixes them: `PaytmViewModelTest.kt:73 vs :96`) |

The mockito-kotlin **Nhaarman fork** (`com.nhaarman.mockitokotlin2`) is repo-wide — no migration to the newer `org.mockito.kotlin` namespace has started.

## 7. Honest gaps

- **No Compose UI test** to model from. Zero `ComposeTestRule` / `createComposeRule` / `setContent` matches anywhere. The `/devkit:cover` adapter has no in-repo template for Compose; the team will need a first one.
- **No instrumented (androidTest) test**, beyond the auto-generated `ExampleInstrumentedTest`. Anything Espresso/UiAutomator-shaped is out of scope.
- **No Hilt test rule (`HiltAndroidRule`) sightings** — despite CLAUDE.md stating Hilt is the DI standard. ViewModels and Repositories are built by hand in tests via constructor; the adapter should mirror that, not auto-emit `@HiltAndroidTest`.
- **`@PrepareForTest` / `PowerMockRunner` are absent** in `src/test/` — only the `PowerMockRobolectricTest` abstract scaffold exists, nothing extends it (in sampled files). Confirming repo-wide would need a grep for `: PowerMockRobolectricTest()`.
- **Git history blocked** in this sandbox, so "direction of travel" rests on filename/style heuristics + CLAUDE.md guidance rather than commit dates.
- **mockito-kotlin 2.2.0** is pinned to the abandoned Nhaarman fork — adapter must keep emitting `com.nhaarman.mockitokotlin2.*` imports, not the newer `org.mockito.kotlin.*`, until a deliberate migration.
- Did not deep-read every module — drug DB tests, chats sendbird tests, plus tests with JSON fixtures, controller deeplink registry tests are unsampled and might surface additional patterns (e.g., JSON resource loading helper).
- The `:test` shared module is **read-only consumed**; didn't validate whether all modules `testImplementation project(':test')` — `network.gradle:73-75` notably does **not** include it, suggesting network module tests must be self-contained (a constraint the adapter must respect for that module).

## Key recommendations for the `/devkit:cover` adapter (implied, not generated)

- Default test class header: `@RunWith(JUnit4::class) class FooTest` with mockito-kotlin (`com.nhaarman.mockitokotlin2.*`) + Truth.
- Use `@get:Rule val instantExecutorRule = InstantTaskExecutorRule()` for LiveData ViewModel tests (modern variant).
- For coroutines: prefer `TestCoroutinesRule` from `com.practo.fabric.test.coroutines.TestCoroutinesRule` (shared) over hand-rolled `Dispatchers.setMain` — falls back to per-test `runTest(testDispatcher)` when needing fine-grained dispatcher control.
- For statics: emit `Mockito.mockStatic` with `@Before/@After` close pattern (matches `MediaListingPagingDataSourceTest.kt:47-72`), not PowerMock.
- For Kotlin top-level extension statics, switch to `mockkStatic("…Kt")` (mixed-file precedent exists: `PaymentOptionsViewModelTest.kt:80`).
- Backtick `should X when Y` method names for new tests — matches dominant newer style.
- Place private fixture builders at the bottom of the file; promote to `<Domain>StubFactory.kt` / `<Domain>TestHelper.kt` when reused across files.
- Java fallback (if generating for the 2 Java files or any new Java code): `testXxx_yyy` + `MockitoAnnotations.initMocks(this)` + `@RunWith(JUnit4.class)`.
- Skip Hilt/`@HiltAndroidTest` and Compose test rules — no in-repo precedent; will need explicit human design before the adapter emits these.
