# Platform adapters

`/devkit:cover` is platform-aware. Each subdirectory here is a **platform
adapter** — a self-contained folder that teaches the cover command how to detect,
classify, scaffold, and template tests for one ecosystem. The shared command
bodies (`commands/cover/*.md`) and the `test-engineer` agent stay platform-neutral;
all platform knowledge lives here.

## Adapter contract

A platform `<name>/` provides:

| Path | Required | Purpose |
|---|---|---|
| `detect.md` | ✅ | Rules that decide whether a target path is this platform. Front-matter `priority:` orders evaluation (lower = checked first). Emits `PLATFORM`, `PLATFORM_ROOT`, and platform flags. |
| `classifications.md` | ✅ | Maps a source file → a classification → a template. Read by `discover.md` / `file.md` / `cover.md` when this platform is detected. |
| `conventions.md` | ✅ | The rules every generated test must follow. Inlined verbatim into each `test-engineer` prompt. |
| `templates/<classification>.template.md` | ✅ (per classification) | The per-classification test skeleton with `{{ placeholders }}` and a worked example. |
| `scaffolds/*` | optional | Files `--setup` generates (jest config, setup, test helpers). |
| `mocks/*` | optional | Reusable boundary mocks the adapter relies on (copied or imported). |

## How detection picks a platform

Every cover mode runs **Phase 0 — Detect platform**: it lists this directory,
reads each `detect.md`, and picks the first match by ascending `priority`. Add a
platform by dropping in a new folder — no changes to the router required for
detection (the shared command bodies carry small `if PLATFORM==<x>` branches only
where classification tables or scaffolding genuinely differ).

## Current adapters

| Platform | priority | Granularity | Test location | Stack |
|---|---|---|---|---|
| `react-native` | 10 | one file per source | co-located `__tests__/` | Jest + Redux Toolkit + RTL |
| `node` | 20 | one file per **public method** | centralized `tests/unit/` | ts-jest + TypeDI + Mongoose |
| `android` | 30 | one file per source | `<module>/src/test/java/` (mirrored package) | JUnit4 + mockito-kotlin (Nhaarman) + Truth + coroutines-test, run via gradle |

`react-native` is checked first; `node` is the backend fallback (it bumps out when
`react-native` is in deps); `android` catches native Gradle repos (no
`package.json` anywhere — an RN repo's embedded `android/` folder bumps back to
`react-native`).

## Adding a new platform

1. Create `platforms/<name>/detect.md` with a `priority:` that doesn't collide.
2. Add `classifications.md` + `conventions.md`.
3. Add one `templates/<classification>.template.md` per classification.
4. Add `scaffolds/` for `--setup` if the platform needs bootstrapping.
5. If your classifications differ from existing platforms, add small
   `if PLATFORM==<name>` branches in `commands/cover/{file,discover,setup}.md` and
   the router `cover.md` (mirror how `node` does it).
6. Update this table and `references/help/cover.md`.
