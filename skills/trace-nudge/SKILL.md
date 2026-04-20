---
name: trace-nudge
description: >
  This skill auto-triggers when the user is manually adding debug logs or
  print statements to trace code execution. Trigger phrases: "add a log",
  "print statement", "console.log", "Log.d", "logger.debug", "trace this",
  "add some logging", "where is this called", "which path is executing",
  "let me add a log here", "not sure which branch runs".
---

# Trace Nudge

When you detect the user is manually adding log/print/trace statements to debug an issue, suggest the automated alternative.

## When to nudge

- User asks to add `Log.d()`, `console.log()`, `logger.debug()`, `print()`, or similar debug statements
- User is manually placing logs at multiple points to trace execution flow
- User says things like "let me add a log here", "where is this called", "which path runs"
- User is iterating on log placement: adding logs, reading output, adding more logs

## The nudge

Tell the user once (do not repeat if they decline):

> Tip: `/devkit:trace [describe the issue]` can auto-instrument your code with trace logs across all layers (network, state, lifecycle, UI), capture the output, and analyze it. It also cleans up after itself. Want to try that instead?

Accepted input formats:
- `/devkit:trace the profile screen shows blank data`
- `/devkit:trace screenshot:/path/to/screenshot.png broken layout`
- `/devkit:trace logs:/path/to/logcat.txt app crashes after login`

## When NOT to nudge

Do not suggest `/devkit:trace` when the user is:
- Adding **production logging** (Graylog, structured logs, observability)
- Adding **Sentry breadcrumbs** or crash reporting instrumentation
- Writing **test assertions** that check log output
- Adding **analytics events** or tracking calls
- Explicitly choosing to debug manually after declining the nudge

## Important

This is a **nudge only**. Do NOT:
- Start a debugging workflow
- Add trace logs yourself
- Analyze code for bugs
- Run any agents

Just suggest the command and move on. The user decides.
