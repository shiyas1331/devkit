# /devkit:trace — Help

## Scenario menu

```
/devkit:trace — pick a mode

📖 TRACE
  1. From a description (text only)
     → /devkit:trace <bug description>
     E.g. "/devkit:trace login button does nothing after submit"

  2. With a screenshot
     → /devkit:trace screenshot:<path> <description>
     E.g. "/devkit:trace screenshot:/tmp/error.png the layout is wrong"

  3. With a log file
     → /devkit:trace logs:<path> <description>
     E.g. "/devkit:trace logs:/tmp/logcat.txt app crashes on startup"

  4. Combine multiple inputs
     → /devkit:trace screenshot:<path1> logs:<path2> <description>
     Multiple screenshots and log files can be combined with text in any order.
```

## Number → command mapping

| Reply | Runs as |
|---|---|
| `1 <description>` | `/devkit:trace <description>` |
| `2 <screenshot-path> <description>` | `/devkit:trace screenshot:<path> <description>` |
| `3 <log-path> <description>` | `/devkit:trace logs:<path> <description>` |
| `4 <inputs>` | paste the full command |

## Verbose flag reference

Printed when the user replies `?`.

```
How it works:
  1. Analyzes the codebase to map files related to the bug
  2. Detects platform (Android / iOS / RN / React / Java / Python) and connected devices
  3. Adds TRACE_* logs at strategic layers (NET / STATE / VM / LC / NAV / UI / DATA)
  4. You reproduce the bug; the command captures and analyzes logs
  5. Narrows to a suspect layer with deeper traces if needed
  6. Presents root cause and proposed fix for your approval
  7. Applies the fix, removes all trace logs

Supported platforms:
  • Android (Kotlin/Java) — uses adb logcat
  • iOS (Swift) — simulator only via xcrun simctl
  • React Native, React (web)
  • Java (Spring), Python (Django/Flask)

Inputs:
  Text description    Plain prose: "the login button does nothing"
  screenshot:<path>   Image of the bug; tool reads it as evidence
  logs:<path>         Log file; tool parses for TRACE_* and error-level entries

Multiple inputs combine. There are no flags besides --help/-h/?.
```
