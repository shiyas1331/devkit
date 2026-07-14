---
platform: android
---

# Test conventions — android (Kotlin + JUnit4)

These rules are inlined verbatim into every `test-engineer` prompt for
`PLATFORM=android`. They encode the dominant *newer* style observed in the
target repo (see the fabric-droid pattern analysis) — when the repo mixes
styles, generate the newer one.

## 1. File layout & naming

- One test file per source file:
  `<MODULE_DIR>/src/test/java/<same package path>/<Name>Test.kt`
- Package declaration identical to the source file's package.
- Class under test `FooViewModel` → `class FooViewModelTest`. A file of
  top-level functions `StringsHelper.kt` → `StringsHelperTest` (use
  `<Name>KtTest` only if that variant already exists nearby).
- Test method names: backtick sentences, contract-style —
  `` fun `should return failure when api throws`() ``. Never `testXxx` in Kotlin.
- If the SOURCE file is Java, emit a Java test instead: `@RunWith(JUnit4.class)`,
  `testMethodName_expectedBehaviour` names, `MockitoAnnotations.initMocks(this)`
  in `setUp()`.

## 2. Class skeleton

```kotlin
@RunWith(JUnit4::class)
class FooViewModelTest {

    @get:Rule
    val instantExecutorRule = InstantTaskExecutorRule()   // ONLY if the VM exposes LiveData

    private val repository: FooRepository = mock()        // com.nhaarman.mockitokotlin2.mock
    private lateinit var viewModel: FooViewModel

    @Before
    fun setUp() {
        // stub + construct here when stubbing is needed; otherwise construct at field init
    }
}
```

- `@RunWith(JUnit4::class)` is the default. Switch to
  `@RunWith(RobolectricTestRunner::class)` ONLY when the code under test
  executes Android framework code (`Uri.parse`, `TextUtils`, …).
- Rule style: `@get:Rule val …` (not `@Rule @JvmField`).
- **Construct the class under test by hand** via its constructor with mocked
  dependencies. NEVER emit `@HiltAndroidTest`, `HiltAndroidRule`, or Dagger
  test components — no in-repo precedent.

## 3. Mocking

- **Primary library: mockito-kotlin, Nhaarman fork.** Imports MUST be
  `com.nhaarman.mockitokotlin2.*` (the repo pins `mockito-kotlin:2.2.0`;
  `org.mockito.kotlin.*` does NOT resolve). Explicit per-symbol imports, no
  wildcards: `mock`, `whenever`, `verify`, `verifyNoMoreInteractions`, `any`,
  `eq`, `argumentCaptor`, `doReturn`, `never`, `times`.
- **Static JAVA methods** (e.g. `LogUtils`, `ApiErrorHandler`,
  `ErrorScreenTracker` — `com.practo.fabric.core.utils.LogUtils`): use
  `Mockito.mockStatic` with close in `@After`:

  ```kotlin
  private lateinit var mockedLogUtils: MockedStatic<LogUtils>

  @Before fun setUp() { mockedLogUtils = Mockito.mockStatic(LogUtils::class.java) }
  @After fun tearDown() { mockedLogUtils.close() }
  ```

  Requires the module resource
  `src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker`
  containing `mock-maker-inline` (`HAS_MOCKMAKER_INLINE`). If absent, create it
  — this is the ONE allowed non-test-code file write.
- **Top-level Kotlin functions / Kotlin `object`s**: use MockK surgically —
  `mockkStatic("com.practo.fabric.core.extensions.ApplicationKt")` /
  `mockkStatic(LogUtils::class)` — and `unmockkStatic`/`unmockkAll` in `@After`.
  MockK and mockito-kotlin may coexist in one file; prefer mockito-kotlin for
  everything MockK isn't strictly needed for.
- **NEVER use PowerMock** (`@PrepareForTest`, `PowerMockRule`) — functionally
  retired in the repo.
- **OkHttp interceptors**: don't mock — use `MockWebServer` with a real
  `OkHttpClient` and `server.shutdown()` in `@After`.

## 4. Coroutines, dispatchers, RxJava

- If the module has `testImplementation project(':test')`
  (`HAS_TEST_MODULE_DEP=true`), prefer the shared rule:

  ```kotlin
  @get:Rule
  val coroutinesRule = TestCoroutinesRule()   // com.practo.fabric.test.coroutines.TestCoroutinesRule

  @Test fun `should …`() = coroutinesRule.runBlockingTest { … }
  ```

- Otherwise (or when fine-grained dispatcher control is needed), hand-roll:

  ```kotlin
  private val testDispatcher = StandardTestDispatcher()

  @Before fun setUp() { Dispatchers.setMain(testDispatcher) }
  @After fun tearDown() { Dispatchers.resetMain() }

  @Test fun `should …`() = runTest(testDispatcher) { … }
  ```

  After triggering a `viewModelScope.launch`, advance the scheduler
  (`testDispatcher.scheduler.advanceUntilIdle()`) before asserting.
- Suspend repository calls in tests: stub with
  `whenever(repository.load()).thenReturn(Output.Success(data))` inside
  `runTest` / `runBlockingTest`.
- **Legacy RxJava code**: if the class takes a `BaseSchedulerProvider`, pass
  `getTestScheduler()` from `com.practo.fabric.test` (`:test` module,
  trampoline schedulers). If there's no provider hook and no `:test` dep,
  swap via `RxJavaPlugins`/`RxAndroidPlugins` `setInit…SchedulerHandler` to
  `Schedulers.trampoline()` in `@Before` and reset in `@After`.

## 4.5 Android framework leakage into plain JVM tests (validated recipes)

Modules without Robolectric and without `unitTests.returnDefaultValues` throw
`RuntimeException: Method … not mocked` when production code touches
`android.*` at test time. Validated workarounds (test-code only), in order:

1. **Static utility calls in getters/logic** (`TextUtils.isEmpty`, …) →
   `Mockito.mockStatic(TextUtils::class.java)` per test class, `close()` in
   `@After`. Default unstubbed answers (false/0/null) are usually right.
2. **Framework objects built in constructors/init blocks** (e.g. a model whose
   init builds a `SparseArray`) → wrap the FIRST construction in
   `Mockito.mockConstruction(SparseArray::class.java)` inside a one-time
   `@BeforeClass`. Do it once — if the static initializer throws once, the
   class is corrupted for the whole JVM (`NoClassDefFoundError` after).
3. **`switchMap`/`MediatorLiveData`-derived LiveData** only emits with an
   active observer → attach `observeForever {}` in `@Before` (remove in
   `@After` if you keep the reference).
4. **Eager `Uri` fields in models** (`CONTENT_URI` built at class-init via
   `Uri`/`DBUtils`) → same one-time `@BeforeClass` neutralization as recipe 2,
   extended to cover the `Uri` static call (`mockStatic(Uri::class.java)`
   during first touch).
5. **Data-binding `BR` / generated classes** compile against the unit-test
   classpath but can be ABSENT at test **runtime** in library modules
   (`NoClassDefFoundError`). Don't test accessors returning `BR.*` constants —
   skip with an explanatory comment.
6. **Paging3 pipelines** (`Pager` + `cachedIn`): a bare `collect {}` never
   triggers `PagingSource.load()` — each generation needs its `PageEvent` flow
   drained. Without the `paging-testing` artifact (do NOT add deps), build a
   minimal test-only differ on the transitively-available
   `androidx.paging.PagingDataDiffer` and drive generations via
   `collectLatest`.
7. If the class under test is framework-heavy throughout → it was
   misclassified; STOP and report reclassification to `robolectric`.

## 5. Assertions

- **Google Truth**: `import com.google.common.truth.Truth.assertThat` —
  `assertThat(result).isEqualTo(expected)`, `.isTrue()`, `.isNull()`,
  `.containsExactly(…)`.
- The shared `:test` module's infix `isEqualTo` / `assertNotNull` may be used
  when `HAS_TEST_MODULE_DEP=true`, but plain Truth is always acceptable.
- No Hamcrest, no AssertJ, no kotlin.test assertions.

## 6. Fixtures & test data

- Private builder functions at the **bottom** of the test class
  (`private fun paymentRequest(amount: Double = 100.0) = …`) with default
  params for overrides.
- Reused across ≥2 test files → promote to `<Domain>StubFactory.kt` /
  `<Domain>TestHelper.kt` in the same test package. Grep the module's test dir
  for existing `*StubFactory`/`*TestHelper` BEFORE creating one.
- JSON payloads → `<MODULE_DIR>/src/test/resources/api-response/<name>.json`,
  loaded via the classloader. Check for an existing loader helper in the
  module's tests first.
- API response data classes have all-nullable fields — fixtures must exercise
  the null paths, not just fully-populated objects.

## 7. Running tests

Run ONE module-scoped gradle invocation, filtered to the class(es) you wrote:

```bash
cd <PLATFORM_ROOT> && ./gradlew <GRADLE_MODULE>:<UNIT_TEST_TASK> --tests "com.pkg.FooViewModelTest" 2>&1 | tail -80
```

- `GRADLE_MODULE` empty (root project) → `./gradlew <UNIT_TEST_TASK> --tests …`
  — the `--tests` filter is MANDATORY there: the root project has pre-existing
  failing tests on the base branch; an unfiltered run fails for reasons
  unrelated to your work.
- Multiple new test classes in one batch → one run with repeated
  `--tests "…"` flags, not one gradle run per file (JVM startup is ~1–2 min).
- If gradle fails with a JVM/toolchain error on macOS, retry with
  `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.
- Success = `BUILD SUCCESSFUL` and no `FAILED` test lines. On failure, the
  per-test report is at
  `<MODULE_DIR>/build/reports/tests/<UNIT_TEST_TASK>/index.html` and failure
  stacks print inline — parse those, don't re-run blindly.
- NEVER run an unscoped `./gradlew test` (all modules, ~40 min, known-red).

## 8. Hard rules

- Never modify the source file under test — flag suspected bugs as
  `latent_bugs` instead.
- Never add/upgrade dependencies in build files. If a needed test dep is
  missing from the module, STOP and report `needs-human` (that's a `--setup`
  concern). Exception: the MockMaker resource file (§3).
- Never use `android.util.Log` in test doubles — the repo mandates `LogUtils`
  (and in tests you usually `mockStatic` it anyway).
- Deterministic tests only: no `Thread.sleep`, no real time — inject/advance
  test dispatchers.
- Follow AAA (Arrange-Act-Assert) with blank-line separation; `// Arrange` /
  `// Act` / `// Assert` comments optional but used in newer files.
- 4-space indent, 120-char lines, explicit imports only.
