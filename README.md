# devkit

A Claude Code plugin with debugging, code analysis, and developer productivity commands.

## Install

Run these commands in your terminal:

```bash
claude plugin marketplace add shiyas1331/devkit
claude plugin install devkit@shiyas-devkit
```

Restart your Claude Code session. The plugin is now available.

### From Source (local testing)

If you want to make changes and test locally:

```bash
git clone https://github.com/shiyas1331/devkit.git
cd devkit
claude --plugin-dir .
```

## Upgrade

When a new version is released:

```bash
claude plugin marketplace update shiyas-devkit
claude plugin update devkit@shiyas-devkit
```

Changes take effect in your next Claude Code session.

## Uninstall

```bash
claude plugin uninstall devkit@shiyas-devkit
claude plugin marketplace remove shiyas-devkit
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

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

MIT
