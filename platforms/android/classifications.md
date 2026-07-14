---
platform: android
---

# Classification table — android

The shared commands (`discover.md`, `file.md`, `cover.md`) read this table when
`PLATFORM==android`. It maps a Kotlin/Java source file to one of the android
test templates under `platforms/android/templates/`.

Derived from the fabric-droid pattern analysis
(`research/2026-05-19-multi-platform-test-analysis/raw/fabric-droid-analysis.md`):
the repo tests ViewModels, Repositories, utils/extension files, OkHttp
interceptors, deep-link handlers, PagingSources, and Gson model parsing — and
tests nothing UI-shaped (no Activity/Fragment/Compose test precedent).

## Classification table

| Signal | Classification | Template |
|---|---|---|
| class `*ViewModel` extending `ViewModel`/`AndroidViewModel`/a Base VM | `viewmodel` | `viewmodel.template.md` |
| class `*Repository` / `*RepositoryImpl` (concrete class, not the interface) | `repository` | `repository.template.md` |
| `*Utils.kt` / `*Helper.kt` / `*Extensions.kt` / any file of top-level functions, **pure JVM** (no Android framework types) | `util` | `util.template.md` |
| class implementing `okhttp3.Interceptor` | `interceptor` | `interceptor.template.md` |
| `*DeepLinkHandler` or util/helper that touches Android framework statics (`Uri.parse`, `TextUtils`, `Color`, `Base64`, resource lookups) | `robolectric` | `robolectric.template.md` |
| class extending `PagingSource<K, V>` | `pagingsource` | `pagingsource.template.md` |
| Gson/Moshi response data class **with custom deserialization, defaults, or computed properties** | `model` | `model.template.md` |
| trivial data class (only `@SerializedName` fields, no logic), `sealed`/`enum` without logic | `other` | (skip — no behavior) |
| Activity / Fragment / Adapter / custom View / `@Composable` / DataBinding | `other` | (skip — no in-repo test precedent; needs human design) |
| Hilt `@Module` / `@InstallIn` DI wiring, Retrofit API interfaces, `interface` contracts | `other` | (skip) |
| generated code (`build/`, `databinding`, `BR`, `R`), `Constants` files | `other` | (skip) |

## Sub-classification notes

- **util vs robolectric**: read the imports. Only `java.*`/`kotlin.*`/project
  domain types → `util` (plain JUnit, fastest). Any `android.*` import that
  executes at test time (`Uri`, `TextUtils`, `Patterns`, `Color`, `Base64`,
  `Context`-dependent code) → `robolectric` (`@RunWith(RobolectricTestRunner::class)`).
  `Context` used only as a pass-through parameter can stay `util` with a mocked
  Context.
- **viewmodel flavors**: LiveData VMs need `InstantTaskExecutorRule`;
  StateFlow-only VMs don't. Both need the main-dispatcher swap (see
  conventions §4). Presenters (legacy MVP in `order/`, `src/consult/`,
  `src/search/`) classify as `viewmodel` too — same shape: mock the view
  interface + repository.
- **repository**: mock the Retrofit API interface it wraps; never hit the
  network. Legacy RxJava repositories (returning `Single`/`Maybe`) still
  classify as `repository` — the template covers both suspend and Rx variants.
- **model**: only worth a test when parsing can go wrong — custom
  `@JsonAdapter`, default values, computed properties, or a JSON fixture
  already exists under `src/test/resources/api-response/`. Pure field-bag
  classes are `other`.
- **abstract base classes** (`Base*ViewModel`, `Base*Repository`): mark
  `other`/skip — coverage comes through concrete subclasses.

## Scan roots

When discovering (`discover.md`), scan:
- `<MODULE_DIR>/src/main/java/**` (and `src/main/kotlin/**` if present)

Exclude: `src/test/`, `src/androidTest/`, `build/`, generated sources,
`*Test.kt`, flavor source sets (`src/production/`, `src/staging/`) unless the
user targets them explicitly.

## "Already tested" check (per-file)

Android uses **one test file per source file**, mirrored under the module's
test source set:

```
<MODULE_DIR>/src/test/java/<package path>/<Name>Test.kt
```

- Top-level extension/function files may use the `<Name>KtTest.kt` variant —
  check both before declaring a file untested.
- The 2 legacy Java tests live under the app-root `src/test/java/` — a Java
  source counts as tested if `<Name>Test.java` exists.
- Partially-covered files (test exists but public methods are missing from it)
  count as **tested** for discovery purposes in v1 — extending an existing test
  file is a `file.md` single-file operation, not a batch one.
