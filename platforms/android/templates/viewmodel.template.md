---
classification: viewmodel
file_extension: .kt
---

# ViewModel test template (android)

For `*ViewModel` classes (and legacy MVP `*Presenter`s — same shape). The VM is
constructed **by hand** with mocked dependencies (repository, helpers,
scheduler provider). No Hilt. One test file for the whole class.

## What to cover

1. **Initial state** — default values of every exposed LiveData/StateFlow.
2. **Each public action** (`fetchX()`, `onYClicked()`, `setZ(…)`) →
   the resulting state/LiveData/StateFlow value.
3. **Repository success path** — stub the repo (`Output.Success` /
   `NetworkResponse.Success` / plain model), call the action,
   `advanceUntilIdle()`, assert exposed state.
4. **Repository failure path** — `Output.Failure(message)`; assert error state
   AND that the VM doesn't crash.
5. **Repository error path** — `Output.Error(throwable)` (or a thrown
   exception when the repo API throws); if the VM calls
   `LogUtils.logException`, `mockStatic` it.
6. **Interaction contracts** — `verify(repository).method(expectedArgs)`;
   `verify(…, never())` for guarded paths.
7. **Branches** — every `if`/`when` reachable from a public entry point
   (flags, nullable fields of the all-nullable response models).
8. **Event Channels** (`events: Flow<Event>`) — collect the first emission
   inside `runTest` and assert it.

Skip: private methods, trivial getters, anything requiring Android framework
classes the VM shouldn't own (flag as latent bug instead).

## Template

```kotlin
package {{ package }}

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import com.google.common.truth.Truth.assertThat
import com.nhaarman.mockitokotlin2.mock
import com.nhaarman.mockitokotlin2.verify
import com.nhaarman.mockitokotlin2.whenever
import com.practo.fabric.core.utils.Output
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4
{% if uses_livedata %}import {{ getOrAwaitValue_import }}
{% endif %}{% for imp in extra_imports %}import {{ imp }}
{% endfor %}
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(JUnit4::class)
class {{ viewModelClass }}Test {

    @get:Rule
    val instantExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = StandardTestDispatcher()

{% for dep in dependencies %}    private val {{ dep.field }} = mock<{{ dep.type }}>()
{% endfor %}
    private lateinit var viewModel: {{ viewModelClass }}

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        {{ default_stubs }}
        viewModel = {{ viewModelClass }}({{ constructor_args }})
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `should expose default state initially`() {
        // Asserts the pre-load default. If the VM loads in init{}, wrap in runTest + advanceUntilIdle().
        assertThat(viewModel.{{ state_property }}.{{ read }}).isEqualTo({{ initial_value }})
    }

    @Test
    fun `should {{ success_contract }}`() = runTest(testDispatcher) {
        // Given
        whenever({{ repositoryField }}.{{ repoMethod }}({{ args }})).thenReturn({{ success_result }})

        // When
        viewModel.{{ action }}({{ action_args }})
        advanceUntilIdle()

        // Then
        assertThat(viewModel.{{ state_property }}.{{ read }}).isEqualTo({{ success_state }})
        verify({{ repositoryField }}).{{ repoMethod }}({{ expected_args }})
    }

    @Test
    fun `should {{ failure_contract }}`() = runTest(testDispatcher) {
        // Given — repository returns a handled failure
        whenever({{ repositoryField }}.{{ repoMethod }}({{ args }})).thenReturn(Output.Failure({{ failure_message }}))

        // When
        viewModel.{{ action }}({{ action_args }})
        advanceUntilIdle()

        // Then
        assertThat(viewModel.{{ state_property }}.{{ read }}).isEqualTo({{ failure_state }})
    }

    @Test
    fun `should {{ error_contract }}`() = runTest(testDispatcher) {
        // Given — repository signals an error
{% if repo_returns_error %}        whenever({{ repositoryField }}.{{ repoMethod }}({{ args }})).thenReturn(Output.Error({{ throwable }}))
{% else %}        whenever({{ repositoryField }}.{{ repoMethod }}({{ args }})).thenThrow({{ throwable }})
{% endif %}
        // When
        viewModel.{{ action }}({{ action_args }})
        advanceUntilIdle()

        // Then
        assertThat(viewModel.{{ state_property }}.{{ read }}).isEqualTo({{ error_state }})
    }
}
```

Notes:
- `{{ read }}` is `value` for both LiveData (InstantTaskExecutorRule makes it
  synchronous) and StateFlow. Use `getOrAwaitValue()` ONLY if the module's
  tests already have that helper — do not create it.
- Repos that don't return `Output<T>` (legacy): substitute the module's actual
  result type (`NetworkResponse`, plain model, Rx `Single`) in the
  success/failure/error triplet — keep all three cases.
- If the module has `testImplementation project(':test')`, the manual
  `setMain/resetMain` may be replaced with
  `@get:Rule val coroutinesRule = TestCoroutinesRule()` +
  `coroutinesRule.runBlockingTest { … }`.
- VM constructors taking a `BaseSchedulerProvider` (legacy Rx) → pass
  `getTestScheduler()` from `com.practo.fabric.test`.
- `switchMap`-derived LiveData (`MediatorLiveData`) only emits with an active
  observer — attach `observeForever {}` in `setUp()` for each derived property
  you assert on.
- Add fixture builders as `private fun` at the bottom of the class when
  response objects are non-trivial.

## Worked example (condensed from a real repo test)

```kotlin
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(JUnit4::class)
class PaytmViewModelTest {

    @get:Rule
    val instantExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = StandardTestDispatcher()

    private val repository = mock<PaytmRepository>()
    private val userProfileHelper = mock<UserProfileHelper>()

    private lateinit var viewModel: PaytmViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        whenever(userProfileHelper.getMobileNumber()).thenReturn("")
        viewModel = PaytmViewModel(userProfileHelper, repository, getTestScheduler())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `should expose wallet balance when fetch succeeds`() = runTest(testDispatcher) {
        // Given
        val response = PaytmOtpResponse().apply {
            apiStatus = "success"
            payload = PaytmOtpResponse.OtpResponsePaytm().apply { balance = 11.00f }
        }
        whenever(repository.getWalletBalance()).thenReturn(response)

        // When
        viewModel.fetchWalletBalance()
        advanceUntilIdle()

        // Then
        assertThat(viewModel.walletBalance.value).isEqualTo(11.00)
        assertThat(viewModel.fetchBalanceResponse.value).isEqualTo(NetworkResponse.Success(response))
    }

    @Test
    fun `should expose error when fetch fails`() = runTest(testDispatcher) {
        // Given
        val response = PaytmOtpResponse().apply { apiStatus = "failure" }
        whenever(repository.getWalletBalance()).thenReturn(response)

        // When
        viewModel.fetchWalletBalance()
        advanceUntilIdle()

        // Then
        assertThat(viewModel.fetchBalanceResponse.value).isEqualTo(NetworkResponse.Error(response))
    }
}
```
