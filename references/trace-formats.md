# Trace Log Formats by Platform

Reference for the `/devkit:trace` command. Defines the standard TRACE_* log format for each supported platform.

## Trace Categories

| Tag | Purpose |
|-----|---------|
| `TRACE_NET` | API request/response |
| `TRACE_STATE` | State changes (Redux, ViewModel, store) |
| `TRACE_VM` | ViewModel/controller operations |
| `TRACE_LC` | Lifecycle events |
| `TRACE_NAV` | Navigation/routing events |
| `TRACE_UI` | Render/draw events |
| `TRACE_DATA` | Data layer (DB, cache, storage) |

## Format by Platform

### Android (Kotlin/Java)
```kotlin
Log.d("TRACE_NAV", "[ClassName][methodName] description var=$variable")
```

### iOS (Swift)
```swift
print("[TRACE_NAV][ClassName][methodName] description var=\(variable)")
```

### React Native / React
```javascript
console.log('[TRACE_NAV]', '[ComponentName][methodName]', 'description', variable)
```

### Java (Spring Boot)
```java
logger.debug("[TRACE_NAV][ClassName][methodName] description var={}", variable);
```

### Python (Django/Flask)
```python
logger.debug(f"[TRACE_NAV][ClassName][methodName] description var={variable}")
```

## Log Capture Commands

### Android (adb)
```bash
# Filtered capture (trace logs only)
adb logcat -d -s TRACE_NET TRACE_STATE TRACE_VM TRACE_LC TRACE_NAV TRACE_UI TRACE_DATA

# Broad capture with grep
adb logcat -d | grep "TRACE_"

# Error logs
adb logcat -d | grep -i "FATAL\|Exception\|Error\|crash"
```

### iOS (Simulator)
```bash
# Live stream (run before reproducing)
xcrun simctl spawn booted log stream --level debug --style compact --predicate 'eventMessage CONTAINS "TRACE_"'

# Error stream
xcrun simctl spawn booted log stream --level error --style compact
```

### React Native (Metro)
Trace logs appear in Metro bundler console output. Filter with:
```bash
# If piping Metro output
grep "TRACE_" metro.log
```

### Web (Browser)
Filter browser DevTools console with `TRACE_` prefix.
