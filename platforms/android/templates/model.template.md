---
classification: model
file_extension: .kt
---

# Model / response data class test template (android)

For Gson/Moshi response data classes **with behavior worth pinning**: custom
deserialization, default values, or computed properties. Trivial field-bag
classes classify as `other` — do not generate for those.

## What to cover

1. **Full parse** — a complete JSON payload maps into every field
   (`@SerializedName` names match; snake_case → camelCase).
2. **Missing-field tolerance** — a minimal payload leaves every optional field
   `null` without throwing (repo rule: ALL response fields are nullable).
3. **Computed properties / logic** — `isSuccessful`-style derived values,
   one test per branch.
4. **Custom adapters / defaults** — `@JsonAdapter`, default params, `init`
   logic: pin the transformed value.

Prefer an existing JSON fixture from
`<MODULE_DIR>/src/test/resources/api-response/` when one matches; otherwise
inline the JSON as a raw string.

## Template

```kotlin
package {{ package }}

import com.google.common.truth.Truth.assertThat
import com.google.gson.Gson
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4
{% for imp in extra_imports %}import {{ imp }}
{% endfor %}
@RunWith(JUnit4::class)
class {{ modelClass }}Test {

    private val gson = Gson()

    @Test
    fun `should parse full payload into all fields`() {
        // Given
        val json = """{{ full_json }}"""

        // When
        val model = gson.fromJson(json, {{ modelClass }}::class.java)

        // Then
{% for field in fields %}        assertThat(model.{{ field.name }}).isEqualTo({{ field.expected }})
{% endfor %}    }

    @Test
    fun `should tolerate missing fields as null`() {
        // Given — minimal payload, every optional field absent
        val json = """{{ minimal_json }}"""

        // When
        val model = gson.fromJson(json, {{ modelClass }}::class.java)

        // Then — nullable fields stay null, no crash
{% for field in nullable_fields %}        assertThat(model.{{ field.name }}).isNull()
{% endfor %}    }
{% for prop in computed_properties %}
    @Test
    fun `should {{ prop.contract }}`() {
        // Given
        val model = {{ modelClass }}().apply { {{ prop.setup }} }

        // When
        val result = model.{{ prop.invocation }}

        // Then
        assertThat(result).isEqualTo({{ prop.expected }})
    }
{% endfor %}
}
```

Notes:
- Moshi models: swap `Gson()` for the module's configured `Moshi` instance
  (grep the module for `Moshi.Builder`) and `adapter(...).fromJson(json)`.
- A non-null field that the parse test proves CAN arrive absent from the API →
  flag as a latent bug (`undefined-vs-null` category), don't change the model.
- When a fixture exists under `src/test/resources/api-response/`, load it via
  the module's existing loader helper (grep the test dir first); only inline
  JSON when no fixture fits.
- Keep inline JSON minimal — only fields the assertions reference.

## Worked example (condensed from a real repo test)

```kotlin
@RunWith(JUnit4::class)
class PaymentBaseResponseTest {

    @Test
    fun `should be successful when api status is success`() {
        // Given
        val paymentResponse = PaymentBaseResponse()
        paymentResponse.apiStatus = PaymentBaseResponse.SUCCESS

        // When
        val result = paymentResponse.isSuccessful

        // Then
        assertThat(result).isTrue()
    }
}
```
