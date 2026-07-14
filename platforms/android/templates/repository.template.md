---
classification: repository
file_extension: .kt
---

# Repository test template (android)

For `*Repository` / `*RepositoryImpl` classes wrapping a Retrofit API interface
(plus preferences/helpers). Mock the API interface and every injected dep —
never hit the network. Construct the repository at field init when no stubbing
is needed in `@Before`.

## What to cover

1. **Delegation** — the API method is called with the exact expected arguments
   (tokens, ids, query params): `verify(apiService).method(expectedArgs)`.
2. **Success mapping** — API returns a response → repository returns
   `Output.Success(mapped)` (or the module's legacy result type).
3. **Failure mapping** — API returns an unsuccessful `retrofit2.Response` /
   failure body → `Output.Failure(message)`.
4. **Error path** — API throws → `Output.Error(throwable)`; assert no rethrow
   and (when the repo logs) that `LogUtils.logException` was invoked
   (`Mockito.mockStatic`).
5. **Caching / preference branches** — cached value present vs absent;
   `verify(preferences).set(key, value)` on writes.
6. **Any transform** applied to the response before returning (filtering,
   defaulting, merging) — including null-field tolerance (all response fields
   are nullable).

Skip: the Retrofit interface itself, plain DTO pass-throughs with no logic.

## Template

```kotlin
package {{ package }}

import com.google.common.truth.Truth.assertThat
import com.nhaarman.mockitokotlin2.mock
import com.nhaarman.mockitokotlin2.times
import com.nhaarman.mockitokotlin2.verify
import com.nhaarman.mockitokotlin2.whenever
import com.practo.fabric.core.utils.Output
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4
{% for imp in extra_imports %}import {{ imp }}
{% endfor %}
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(JUnit4::class)
class {{ repositoryClass }}Test {

{% for dep in dependencies %}    private val {{ dep.field }} = mock<{{ dep.type }}>()
{% endfor %}
    private val repository = {{ repositoryClass }}({{ constructor_args }})

    @Test
    fun `should call {{ apiMethod }} with correct arguments when {{ repoMethod }} is called`() = runTest {
        // Given
        {{ delegation_stubs }}

        // When
        repository.{{ repoMethod }}({{ repo_args }})

        // Then
        verify({{ apiServiceField }}, times(1)).{{ apiMethod }}({{ expected_api_args }})
    }

    @Test
    fun `should return success when {{ apiMethod }} succeeds`() = runTest {
        // Given
        whenever({{ apiServiceField }}.{{ apiMethod }}({{ api_args }})).thenReturn({{ success_response }})

        // When
        val result = repository.{{ repoMethod }}({{ repo_args }})

        // Then
        assertThat(result).isEqualTo(Output.Success({{ mapped_result }}))
    }

    @Test
    fun `should return failure when {{ apiMethod }} responds unsuccessfully`() = runTest {
        // Given
        whenever({{ apiServiceField }}.{{ apiMethod }}({{ api_args }})).thenReturn({{ failure_response }})

        // When
        val result = repository.{{ repoMethod }}({{ repo_args }})

        // Then
        assertThat(result).isEqualTo(Output.Failure({{ failure_message }}))
    }

    @Test
    fun `should return error when {{ apiMethod }} throws`() = runTest {
        // Given
        val throwable = RuntimeException("boom")
        whenever({{ apiServiceField }}.{{ apiMethod }}({{ api_args }})).thenThrow(throwable)

        // When
        val result = repository.{{ repoMethod }}({{ repo_args }})

        // Then
        assertThat(result).isEqualTo(Output.Error(throwable))
    }
}
```

Notes:
- Add one extra `@Test` per caching/preference/transform branch found in the
  source (same Given/When/Then shape).
- Suspend stubbing inside `runTest` works with plain `whenever(…)`; for
  stubbing outside a coroutine use
  `apiService.stub { onBlocking { method(…) }.doReturn(response) }`.
- If the repo catches and logs (`LogUtils.logException`), add
  `Mockito.mockStatic(LogUtils::class.java)` in `@Before` and `close()` in
  `@After` (requires the module's mock-maker-inline resource).
- Legacy Rx repositories: replace `runTest` with direct calls on the returned
  `Single`/`Maybe`, passing `getTestScheduler()` when the repo takes a
  `BaseSchedulerProvider`.
- Repos not returning `Output<T>`: keep the success/failure/error triplet with
  the module's actual result type.

## Worked example (condensed from a real repo test)

```kotlin
@RunWith(JUnit4::class)
class ConsultHomeRepositoryTest {

    private val apiServiceMock = mock<ConsultHomeApiService>()
    private val accountsRepositoryMock = mock<AccountsRepository>()
    private val deviceUtilsMock = mock<DeviceUtils>()
    private val preferencesMock = mock<ConsultPreferences>()
    private val resourcesUtilsMock = mock<ResourcesUtils>()

    private val repository = ConsultHomeRepository(
        apiServiceMock, accountsRepositoryMock, deviceUtilsMock,
        preferencesMock, resourcesUtilsMock, getTestScheduler()
    )

    @Test
    fun `should call predictProblemAreas method of api with correct arguments when search of repository is called`() {
        whenever(accountsRepositoryMock.getProfileToken()).thenReturn("profile_token")
        whenever(accountsRepositoryMock.getUserId()).thenReturn("123456")
        whenever(deviceUtilsMock.deviceId).thenReturn("device_id")
        runBlocking {
            repository.search("thyroid")
            verify(apiServiceMock, times(1)).predictProblemAreas("profile_token", "device_id", "thyroid", "123456")
        }
    }

    @Test
    fun `should sync error section and save it in preference`() {
        whenever(accountsRepositoryMock.getProfileToken()).thenReturn("profile_token")
        runBlocking {
            apiServiceMock.stub {
                onBlocking { getTopSpecialities("profile_token", "uhid") }
                    .doReturn(retrofit2.Response.success(ConsultTestHelper.ERROR_SECTION))
            }
            repository.syncErrorSection("uhid")
            verify(preferencesMock, times(1)).set(
                "consult_error_section",
                Gson().toJson(ConsultTestHelper.ERROR_SECTION)
            )
        }
    }
}
```
