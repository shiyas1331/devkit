# devkit

A Claude Code plugin with debugging, code analysis, and developer productivity commands.

## Installation

```bash
# Add the marketplace
/plugin marketplace add shiyas1331/devkit

# Install the plugin
/plugin install devkit@shiyas1331-devkit
```

Or test locally:
```bash
claude --plugin-dir /path/to/devkit
```

## Commands

### `/devkit:trace` — Auto-instrumented debugging

Automatically instruments your code with trace logs, captures output from connected devices, analyzes results to find the root cause, and cleans up after fixing.

**Usage:**
```
/devkit:trace the login screen shows a blank page after submitting
/devkit:trace screenshot:/tmp/broken-ui.png the layout is wrong
/devkit:trace logs:/tmp/logcat.txt app crashes on startup
```

**Supported platforms:** Android (Kotlin/Java), iOS (Swift), React Native, Web (React), Java (Spring), Python (Django/Flask)

**How it works:**
1. **Understand** — Analyzes codebase to map the execution flow
2. **Detect** — Identifies platform and checks for connected devices
3. **Wide Trace** — Places lightweight `TRACE_*` logs across key layers
4. **Analyze** — Captures and interprets log output
5. **Deep Trace** — Narrows to the suspect layer with detailed instrumentation
6. **Fix** — Presents root cause and proposed fix for approval
7. **Cleanup** — Removes all trace logs, keeps only the fix
8. **Document** — Records the pattern for future reference

## Skills

### `trace-nudge` (auto-triggered)

Detects when you're manually adding debug logs and suggests using `/devkit:trace` instead. Non-intrusive — suggests once, doesn't repeat if declined.

## Agents

The plugin bundles 4 specialized agents that can be used standalone or are called by commands:

| Agent | Purpose |
|-------|---------|
| `devkit:codebase-locator` | Find files by topic — a "super grep" for navigating unfamiliar code |
| `devkit:codebase-analyzer` | Trace data flow and understand how components work |
| `devkit:codebase-pattern-finder` | Find similar implementations and extract reusable patterns |
| `devkit:web-search-researcher` | Research library docs, known issues, and best practices |

## License

MIT
