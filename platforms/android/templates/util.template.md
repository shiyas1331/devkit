---
classification: util
file_extension: .kt
---

# Util / Helper / Extensions test template (android)

For `*Utils.kt` / `*Helper.kt` / `*Extensions.kt` files of pure JVM logic
(top-level functions, `object`s, or simple classes with no Android framework
dependencies). No mocks, no rules, no dispatchers — direct calls + Truth.

If any code under test executes `android.*` framework code (`Uri.parse`,
`TextUtils`, `Patterns`, `Base64`, …), this is NOT a `util` — reclassify as
`robolectric` and STOP (report `needs-human` if no robolectric template is
available yet).

## What to cover (per public function)

1. **Happy path** — representative valid input → expected output.
2. **Edge inputs** — empty string/list, `null` (for nullable params/receivers),
   zero, negative, boundary values.
3. **Invalid input** — malformed input → the documented fallback (`0`, `""`,
   `null`, default) rather than a throw; if it throws, pin the exception type
   with a `throws`-kind case (`assertThrows`).
4. **Each branch** — every `if`/`when`/elvis/short-circuit reachable from the
   public signature.
5. **Latent bug pinning** — asymmetric fallbacks, silent catches, locale- or
   timezone-sensitive parsing: pin current behavior with a comment.

Skip: trivial constant accessors, private helpers (covered via the public
functions that use them).

## Template

```kotlin
package {{ package }}

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4
{% if has_throws %}import org.junit.Assert.assertThrows
{% endif %}{% for imp in extra_imports %}import {{ imp }}
{% endfor %}
@RunWith(JUnit4::class)
class {{ utilClass }}Test {
{% for case in cases %}
    @Test
    fun `should {{ case.contract }}`() {
{% if case.given %}        // Given
        {{ case.given }}

{% endif %}{% if case.kind == "throws" %}        // When / Then — pin the thrown exception
        assertThrows({{ case.exception }}::class.java) {
            {{ case.invocation }}
        }
{% else %}        // When
        val result = {{ case.invocation }}

        // Then
        assertThat(result).isEqualTo({{ case.expected }})
{% endif %}    }
{% endfor %}
}
```

Notes:
- Test class name: `<FileName>Test` for a file of top-level functions
  (`StringsHelper.kt` → `StringsHelperTest`); use `<FileName>KtTest` only if
  that variant already exists in the module.
- Extension functions are invoked on the receiver directly:
  `"2020-12-12".getYear(pattern)`.
- Pure functions with several input→output pairs may compress into one test
  with multiple assertions ONLY when they share the same branch; separate
  branches get separate tests.
- No fixtures needed for scalar inputs; use `private fun` builders at the
  bottom for non-trivial domain objects.

## Worked example (real repo test)

```kotlin
@RunWith(JUnit4::class)
class StringsHelperTest {

    @Test
    fun `should return year when date string is valid`() {
        // Given
        val pattern = "yyyy-MM-dd"
        val dateString = "2020-12-12"

        // When
        val year = dateString.getYear(pattern)

        // Then
        assertThat(year).isEqualTo(2020)
    }

    @Test
    fun `should return 0 when pattern is invalid`() {
        // Given
        val pattern = ""
        val dateString = "12-12-2020"

        // When
        val year = dateString.getYear(pattern)

        // Then
        assertThat(year).isEqualTo(0)
    }
}
```
