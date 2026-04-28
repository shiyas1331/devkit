---
description: Auto-instrument code with trace logs, capture output, and fix the bug
argument-hint: <description, screenshot:/path, or logs:/path>
model: opus
---

# Trace and Fix

You are tasked with tracing and fixing a bug by strategically instrumenting code with trace logs, capturing output, and analyzing the results. Your goal is to minimize developer effort — they describe the problem, you do the rest.

**Response format — always (except Phase 5):**
- What was done (max 2-3 bullets)
- Exactly what the developer needs to do right now
- What happens next

Never explain the debugging process. Never narrate your reasoning. Just direct the next action.

> **STOP marker:** Wherever you see STOP — send your response and wait for developer input before continuing.

## Help mode (check first, before any other work)

If `$ARGUMENTS` contains `--help`, `-h`, or `?` as a standalone token, print the help text below verbatim and exit immediately. Do NOT proceed to any other phase.

```
/devkit:trace — Auto-instrumented debugging

Usage:
  /devkit:trace <description of bug>           Trace and fix a bug from a description
  /devkit:trace screenshot:<path> <description>  Add a screenshot as evidence
  /devkit:trace logs:<path> <description>      Provide a log file as evidence

Multiple screenshots and log files can be combined with text in any order.

How it works:
  1. Analyzes the codebase to map files related to the bug
  2. Detects platform (Android / iOS / RN / React / Java / Python) and connected devices
  3. Adds TRACE_* logs at strategic layers (NET / STATE / VM / LC / NAV / UI / DATA)
  4. You reproduce the bug; the command captures and analyzes logs
  5. Narrows to a suspect layer with deeper traces if needed
  6. Presents root cause and proposed fix for your approval
  7. Applies the fix, removes all trace logs

Supported platforms: Android (Kotlin/Java), iOS (Swift), React Native, React (web),
Java (Spring), Python (Django/Flask).

Flags:
  --help, -h    Show this help.

Examples:
  /devkit:trace login screen blank after submit
  /devkit:trace screenshot:/tmp/broken.png the layout is wrong
  /devkit:trace logs:/tmp/logcat.txt app crashes on startup
```

## Input

Bug context: $ARGUMENTS

Parse the input for any combination of:
- **Text description** — everything that isn't a `screenshot:` or `logs:` prefix
- **Screenshots** — paths prefixed with `screenshot:` (e.g., `screenshot:/tmp/broken.png`). Read each image file.
- **Log files** — paths prefixed with `logs:` (e.g., `logs:/tmp/logcat.txt`). Read each file's contents.

Multiple screenshots and log files are supported. All inputs are combined as evidence.

If no arguments provided, ask: "Describe the issue you're seeing — what's the expected vs actual behavior? You can also attach `screenshot:/path` or `logs:/path`. Run `/devkit:trace --help` for a quick overview."

## Context Loading

Before analysis, read available context:
1. `CLAUDE.md` in the repo root (if exists)
2. `.claude/codebase/*.md` (if exists)
3. `.claude/memory/patterns-learned.md` (for past debugging patterns)

## Phase 1: Understand

Launch 2 agents in parallel:

1. **Codebase Locator** — use `subagent_type: "devkit:codebase-locator"`. If unavailable, use Glob + Read tools directly. Prompt:

   ```
   Find all files related to this bug: [bug description].
   Look for: screens/components, API/network layer, state management (ViewModel/Redux/store),
   navigation/routing, lifecycle hooks, data layer (DB/cache/storage), and test files.
   Include configuration files (AndroidManifest.xml, package.json, build.gradle) if relevant.
   ```

2. **Codebase Analyzer** — use `subagent_type: "devkit:codebase-analyzer"`. If unavailable, use Grep + Read tools directly. Prompt:

   ```
   Trace the execution flow for: [bug description].
   Map these layers with file:line references:
   - Network: API calls, interceptors, request/response handling
   - State/ViewModel: state management, data emissions, Redux dispatches
   - Lifecycle: component mount/unmount, Activity/Fragment lifecycle, useEffect hooks
   - Navigation: route transitions, deep links, back stack
   - UI: rendering logic, conditional visibility, data binding
   - Data: database queries, cache reads, storage operations
   Identify where data enters, transforms, and reaches the UI.
   ```

**Wait for both agents to complete.** Read all identified files.

**Fast path:** If agent findings + provided evidence together identify the exact file:line and failure reason with confidence → skip directly to Phase 5. Do not trace speculatively.

## Phase 2: Detect Platform & Environment

### Platform Detection

Detect the platform from build files and imports (e.g., `build.gradle`/`AndroidManifest.xml` → Android, `package.json` with `react-native` → React Native, `*.xcodeproj` + `Podfile` → iOS, `spring-boot` → Java, `manage.py` → Python). For hybrid projects, detect both and trace both sides when the bug crosses the boundary.

### Trace Log Format

Set the trace format based on platform:

- **Android (Kotlin/Java):** `Log.d("TRACE_[CAT]", "[ClassName][method] msg var=$var")`
- **iOS (Swift):** `print("[TRACE_[CAT]][ClassName][method] msg var=\(var)")`
- **React Native / React:** `console.log('[TRACE_[CAT]]', '[ComponentName][method]', msg, var)`
- **Java (Spring):** `logger.debug("[TRACE_[CAT]][ClassName][method] msg var={}", var)`
- **Python (Django/Flask):** `logger.debug(f"[TRACE_[CAT]][ClassName][method] msg var={var}")`

### Device Check

- **Android:** Run `adb devices`. If a device/emulator is listed, set DEVICE_CONNECTED=true.
- **iOS:** Run `xcrun simctl list devices booted`. If a simulator is booted, set DEVICE_CONNECTED=true (simulator mode). For physical iOS devices, use guided mode — CLI log capture on physical devices is unreliable.
- **If `adb`/`xcrun` is not found:** Tell the user the relevant tool is missing. Fall back to guided mode.
- **Otherwise:** DEVICE_CONNECTED=false — use guided mode (manual log placement instructions).

## Phase 3: Wide Trace (Round 1)

### Pre-Trace Checks

**Reproducibility:** Before touching any code, confirm:
- Can the developer reproduce the bug on demand?
- Is it intermittent or consistent?

If intermittent or reproduction steps are unclear, ask: "Can you reliably reproduce this? If it's intermittent, describe the conditions — otherwise tracing may not capture it."

To see all trace lines currently in the code at any point, run: `git diff | grep "^+" | grep "TRACE_"`

---

**Strategy:** Place 1-2 lightweight TRACE_* logs across the 3-4 most relevant layers identified by the Analyzer — not every layer. Start with the entry point, the layer closest to where the symptom appears, and one layer in between. This keeps logs readable and analysis fast.

### Trace Categories

| Tag | What to trace | Example log content |
|-----|---------------|---------------------|
| `TRACE_NET` | API request/response | Request URL + method, response status + body preview |
| `TRACE_STATE` | State changes | Redux dispatch action type + payload, ViewModel state emission |
| `TRACE_VM` | ViewModel operations | Method calls, LiveData/StateFlow emissions with values |
| `TRACE_LC` | Lifecycle events | onCreate/onDestroy, viewDidLoad/viewDidAppear, useEffect mount/cleanup |
| `TRACE_NAV` | Navigation events | Route name + params, back stack state |
| `TRACE_UI` | Render/draw events | Component render trigger, conditional visibility flags, data passed to UI |
| `TRACE_DATA` | Data layer operations | DB query results count, cache hit/miss, SharedPreferences/AsyncStorage reads |

For each layer identified by the Analyzer:
1. Pick the most relevant entry point in the affected code path
2. Add 1-2 TRACE_* logs capturing: method name, key variable values
3. **Track every line added** — maintain a list of `file:line` for cleanup later

### Branch A: Device Connected

1. Auto-instrument the code using the Edit tool
2. Clear the logcat buffer: `adb logcat -c`
3. Tell the user:

   "I've added **[N] trace points** across **[M] files** covering [list of categories].

   **Reproduce the issue now.** Tell me when done."

4. STOP.

### Branch B: No Device (Guided Mode)

1. Present exact instrumentation instructions:

   ```
   Add these trace logs and reproduce the issue:

   1. [file:line] — add: [exact log statement]
   2. [file:line] — add: [exact log statement]
   ...

   After reproducing, either:
   - Paste the relevant log output here, or
   - Save to a file and tell me: logs:/path/to/output.txt
   ```

2. STOP.

## Phase 4: Capture & Analyze Logs

### If Device Connected

**Android:**

Capture our trace logs (filtered, lightweight):
```
adb logcat -d TRACE_NET:D TRACE_STATE:D TRACE_VM:D TRACE_LC:D TRACE_NAV:D TRACE_UI:D TRACE_DATA:D *:S
```

Also capture error-level logs from ALL tags (catches crashes, exceptions, framework errors):
```
adb logcat -d *:E
```

**iOS (Simulator):**

Capture our trace logs using the unified log stream:
```
xcrun simctl spawn booted log stream --level debug --style compact --predicate 'eventMessage CONTAINS "TRACE_"'
```

Note: This streams live — run it before the user reproduces the issue, capture output, then stop. For errors, also run:
```
xcrun simctl spawn booted log stream --level error --style compact
```

### If User Provides Logs

Parse the provided output for TRACE_* entries and error-level messages.

### Analysis

For each trace category, determine:

| Check | What it means |
|-------|---------------|
| Trace fired with expected value | Layer is working correctly |
| Trace fired with unexpected value | **Anomaly — potential root cause** |
| Trace did NOT fire | Layer was never reached — **upstream problem** |
| Traces fired in wrong order | **Timing/lifecycle issue** |

Cross-reference TRACE_* output with error-level logs. Look for exceptions, warnings, or framework errors that correlate with the anomaly.

### Decision

- **Clear root cause found** → Remove trace logs → Go to Phase 5 (Fix)
- **Suspect layer identified, root cause unclear** → Go to Phase 4b (Deep Trace)
- **All layers look fine** → Go to Phase 4b targeting the most suspicious layer

Present a brief trace summary to the user before proceeding:

```
## Trace Results (Round 1)
- TRACE_NET: [status — OK / anomaly / not reached]
- TRACE_STATE: [status]
- TRACE_VM: [status]
- TRACE_LC: [status]
- TRACE_NAV: [status]
- TRACE_UI: [status]
- TRACE_DATA: [status]

Suspect: [layer] — [brief reason]
```

## Phase 4b: Deep Trace (Round 2)

Focus on the **one suspect layer** identified in Round 1. Add 5-10 detailed traces:

- Function entry and exit with parameter values and return values
- State snapshots before and after key operations
- Timing markers for async operations (request start, callback received)
- Error paths and catch blocks
- Conditional branches — which path was taken

Remove the Round 1 wide traces first, then add Round 2 deep traces.

Same capture flow as Phase 4 (device or manual). Same analysis approach.

Tell the user: "Narrowed to the **[layer]** layer. Added detailed traces. **Reproduce again.**"

STOP.

**If root cause found** → Remove trace logs → Go to Phase 5 (Fix).

**If still unclear after Round 2** → Present findings and escalate:

"I've traced through 2 rounds covering [layers]. Here's what I found:
- [finding 1]
- [finding 2]
- [finding 3]

Want to continue with a different angle, or shall we dig into [specific area]?"

## Phase 5: Fix

> **Note:** This phase is exempt from the 2-3 bullet format rule. The developer must understand and approve the fix before any code is changed — full detail is required here.

### Research (conditional)

If the fix approach is unclear, spawn:

**Codebase Pattern Finder** — use `subagent_type: "devkit:codebase-pattern-finder"`. If unavailable, use Grep to find similar patterns directly. Prompt:

```
Find existing patterns for handling [root cause type] in this codebase.
How is [specific pattern] done elsewhere? Show code examples with file:line.
```

If a framework/library bug is suspected, also spawn:

**Web Search Researcher** — use `subagent_type: "devkit:web-search-researcher"`. Prompt:

```
Search for known issues with [library/API] version [X.Y.Z] related to [observed behavior].
Check official docs, GitHub issues, and Stack Overflow.
```

### Present Root Cause

```
## Root Cause

**Layer**: [Network / State / ViewModel / Lifecycle / Navigation / UI / Data]
**Location**: [file:line]
**What's happening**: [step-by-step trace-informed explanation of the code path]
**Why it fails**: [specific reason — null value, timing issue, wrong key, missing callback]
**Evidence**: [which TRACE_* logs revealed this, with actual values observed]

## Proposed Fix

**Strategy**: [brief description]
**Based on pattern at**: [file:line from pattern finder, if used]

### Changes:
1. **[file path]** — [what to change and why]
2. **[test file path]** — [regression test description]

Shall I proceed?
```

STOP.

### Implement

1. Apply the fix using the Edit tool
2. Write a regression test that covers the failure scenario
3. Run verification: build, tests, lint (whatever is available in the project)

## Phase 6: Cleanup

**CRITICAL:** Remove ALL TRACE_* logs added during tracing. Do NOT remove the fix.

1. Search for all trace instrumentation: grep for `TRACE_NET`, `TRACE_STATE`, `TRACE_VM`, `TRACE_UI`, `TRACE_LC`, `TRACE_NAV`, `TRACE_DATA` across source files
2. Remove every matching line using the Edit tool
3. Run a second grep to verify zero TRACE_* lines remain
4. Do NOT touch the developer's existing `Log.d()`, `console.log()`, or `logger.debug()` calls — only remove lines with the `TRACE_` prefix

**If the command was interrupted mid-trace:** Tell the user: "Some TRACE_* logs may remain in the code. Run `git diff` to see instrumented files and `git checkout -- [file]` to revert them."

## Phase 7: Verify

Tell the user: "Fix applied, all trace logs cleaned up. **Reproduce the original issue to verify.**"

- **Still broken (iteration 1-2):** "The fix didn't resolve it. Going back to trace with new information." Return to Phase 3.
- **Still broken (iteration 3+):** "I've tried [N] approaches. Here's everything I've found: [summary of all rounds]. Want to continue, or try a completely different angle?"
- **Fixed:** Confirm cleanup is complete. Run tests if they exist. Proceed to Phase 8.

## Phase 8: Document (only if a new reusable pattern was discovered)

If this debugging session revealed a pattern worth remembering, append to `.claude/memory/patterns-learned.md`:

```
### [Date] — [Bug type] in [layer]
- **Pattern**: [what was wrong]
- **Detection**: [which trace category caught it]
- **Fix**: [how it was resolved]
```

Save a bug report to `specs/bugs/YYYY-MM-DD-description.md`:

```markdown
# [Bug Type]: [Brief Description]

## Trace Summary
- **Platform**: [Android / React Native / React / Java / Python]
- **Layers traced**: [which TRACE_* categories were used]
- **Root cause layer**: [layer]
- **Trace rounds**: [1 or 2]

## Root Cause
[Trace-informed explanation with file:line references]

## Fix Applied
[Description with file:line references]

## Prevention
[How to prevent similar issues in the future]
```
