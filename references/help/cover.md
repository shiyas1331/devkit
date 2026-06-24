# /devkit:cover — Help

> The interactive picker (shown when you run `/devkit:cover` with no args) handles
> mode + scope selection via native UI. This file is the verbose reference for
> users who type `--help`, `-h`, or `?` and want the full mental model.

## Verbose flag reference

```
How it works:
  1. Detects the platform (react-native, node; react/android/ios/java later)
  2. Loads the matching platform adapter from devkit/platforms/<name>/
  3. Discovers untested source files, classifies each per the platform's table
     (RN: slice/thunk/hook/listener/service/container;
      node: manager/repository/mapper/service/util/worker)
  4. For --setup: RN copies jest config, setup.ts, test-utils, native mocks;
     node scaffolds ts-jest config, tests/setup.ts, tests/helpers (typedi + mongoose)
  5. For coverage runs: spawns one test-engineer agent per source file (parallel pool of 5)
  6. Each agent reads its source, picks a template, writes test(s), runs jest, retries failures
     (RN: one co-located file per source; node: one centralized file per public method)
  7. Aggregates results, surfaces latent bugs flagged by agents, reports coverage delta

What it does NOT do:
  • Commit anything — engineer reviews diff and commits manually
  • Modify source files — tests describe behaviour, they don't fix it
  • Replace human judgment on what's worth testing
  • Integration tests (separate command, /devkit:integration — not yet built)
  • E2E tests
  • UI rendering / pixel-level assertions

Supported platforms (today):
  • react-native — Jest + Redux Toolkit + RTL patterns extracted from
    provider-app/packages/editors (PR #470, #471).
  • node — ts-jest + TypeDI + Mongoose patterns extracted from
    content-service (PRs #754–768). Per-method test files under tests/unit/.

Planned platforms:
  • react (web) — close cousin of RN, ~70% template reuse
  • android (Kotlin/Java) — JUnit + MockK + ViewModel testing
  • ios (Swift) — XCTest patterns
  • java (Spring) — JUnit 5

Output:
  • Test files written into <source-dir>/__tests__/ (RN) or <pkg>/tests/unit/ (node)
  • RN: new fixture factories under <package>/src/__tests__/fixtures/ if needed
    node: factories defined locally per test file
  • A run report printed to your terminal
  • Updates to .claude/memory/latent-bugs.md and test-patterns.md

Files NEVER touched by this command:
  • Source files
  • Production code paths
  • Git index (no auto-commits)
  • Any file outside the target package
```

## Flag reference (direct invocation, skip the picker)

| Form | Effect |
|---|---|
| `/devkit:cover` | Open the interactive picker |
| `/devkit:cover <path>` | Discover untested code under <path> |
| `/devkit:cover <file>` | Cover one source file |
| `/devkit:cover <path> --setup` | Scaffold test foundation (one-time) |
| `/devkit:cover <path> --batch slices` | (RN) Cover all slices in <path> |
| `/devkit:cover <path> --batch thunks` | (RN) Cover all thunks |
| `/devkit:cover <path> --batch hooks` | (RN) Cover all hooks (pure + Redux + bottom-sheet) |
| `/devkit:cover <path> --batch services-containers` | (RN) Cover all SQLite services and containers |
| `/devkit:cover <path> --batch managers` | (node) Cover all TypeDI managers |
| `/devkit:cover <path> --batch repositories` | (node) Cover all Mongoose repositories |
| `/devkit:cover <path> --batch mappers` | (node) Cover all mappers |
| `/devkit:cover <path> --batch services` | (node) Cover all SDK-wrapping services |
| `/devkit:cover <path> --batch util` | (node) Cover all pure utils |
| `/devkit:cover <path> --batch workers` | (node) Cover all worker processors/handlers |
| `/devkit:cover <path> --report` | Coverage delta + latent bugs |
| `/devkit:cover --help` | Show this reference |
