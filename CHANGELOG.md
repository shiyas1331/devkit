# Changelog

## v1.3.5 (2026-04-29)

### `/devkit:pr-review` — conditional agent spawning + new convention-checker agent

Cleaned up Phase 2 of `pr-review` so agents only spawn when they have actual work to do. Cost now scales with PR complexity (small PR = 1 agent call; large complex PR = 9–12).

- **New agent** `devkit:convention-checker` — reusable across `pr-review`, the planned `/devkit:review`, and `/devkit:address-pr`. Reads convention docs, checks diff against each rule, classifies deviations by severity (`blocker`/`discuss`/`nit`).
- **Phase 2B gating** — Convention Checker only spawns if convention docs exist (`CLAUDE.md`, `.claude/codebase/*.md`, `CONTRIBUTING.md`, `STYLE.md`). Otherwise skipped silently.
- **Phase 3b new** — Codebase Analyzer fires only on 🔴 files (typically 0–2 per PR). Was previously described as "after triage" but sequencing was contradictory.
- **`/devkit:why` per-finding gating** — invoked only for findings genuinely needing historical "why" context, capped at 7 per PR. Beyond the cap, falls back to cheap inline `git log --oneline`.
- **Removed "Git History Analyzer" framing** — it was a label, not a real agent. Replaced with explicit `/devkit:why` invocations in Phase 3b.

## v1.3.4 (2026-04-29)

### `/devkit:pr-review` — `--post-review` mode (inline comments)

The brief now translates findings into a real GitHub PR review: a summary body + inline comments at the relevant file:lines, posted as a single review.

- New `--post-review` flag — full GitHub review with inline comments. Each comment confirmed individually before posting (default behavior; safer than bulk).
- New `--bulk-confirm` flag — combines with `--post-review` for one y/n on the entire batch instead of per-comment.
- Inline comments tagged with `🤖 [devkit:pr-review]` prefix so authors distinguish tool-generated from human feedback.
- Always posts as `event: COMMENT` — never blocks merge with `REQUEST_CHANGES` or auto-approves.
- Validates every file:line against the latest commit before posting; drops stale-line comments.
- Caps inline comments per file at 5; excess findings move to the summary as `Additional notes on <file>`.
- Warns before posting a review with > 20 inline comments.
- Halts gracefully if no findings have concrete file:line references — suggests `--post` instead.

## v1.3.3 (2026-04-29)

### `/devkit:pr-review` — file output is now opt-in

Default behavior changed: the brief is printed to the terminal only. No files are written unless explicitly asked for. Reduces friction for one-shot reviews and avoids polluting repos.

- New `--save` flag — also write to `specs/reviews/PR-<num>-<slug>.md` (the previous default location).
- New `--save=<path>` — write to a custom path.
- `--post` now implies `--save` (a file is needed for `gh pr comment --body-file`).
- `/devkit:address-pr` continues to read from `specs/reviews/` if a brief exists there.

## v1.3.2 (2026-04-28)

### Refactor — `/devkit:pr-review` and `/devkit:address-pr`

Trimmed both command prompts ~27% with no behavior change. Removed verbose phase intros, redundant calibration reminders, and multi-paragraph philosophy explanations. Kept verbatim: output format templates, edge case tables, quality gates, agent-reference patterns — the parts that enforce consistency. Easier to maintain when adding flags or updating conventions.

## v1.3.1 (2026-04-28)

### Improvements to `/devkit:why`
- **Iterative line-history walk** — most recent commit on a line is often a typo fix or refactor; the command now walks back through history to find the substantive originator. Trivial-commit classifier (typo/format/lint/rename/bot) skips noise.
- **Mechanical confidence labels** (`high`/`medium`/`low`/`none`) with concrete criteria — no more judgment-call inconsistency.
- **PR attribution fix** — filters to merged PRs and picks the earliest, so cherry-picks/backports don't get attributed as the originator.
- **Authoritative squash-merge detection** via PR's `merge_method` field instead of fragile commit-message pattern matching.
- **Distance-filtered review comments** (≤ 10 lines from target) with documented fallback when nothing matches.
- **Configurable ticket prefixes** via `TICKET_PREFIXES` env var to prevent ghost tickets from over-permissive regex.
- **Generated-file detection** with explicit path patterns and content sniffing.
- **Working-tree drift warnings** when the user's line points to unstaged changes.
- **Submodule auto-descend** instead of halting.
- **Confidence in JSON output** for downstream consumers.

## v1.3.0 (2026-04-28)

### Commands
- `/devkit:why` — Explain why a piece of code exists. Pulls git blame, the originating commit, the merging PR's description, the linked JIRA ticket, and review-thread highlights into one grounded answer. Detects special cases: reverted code, superseded PRs, line moves, renames, squash merges, direct-to-main pushes.

## v1.2.0 (2026-04-28)

### Commands
- `/devkit:address-pr` — Author-side companion to `/devkit:pr-review`. Reads open reviewer comments, classifies them (change-request / nit / question / suggestion / praise / out-of-scope / stale / conflict), drafts code fixes and replies, commits in smart batches, posts replies, resolves threads, and re-requests review — all with author approval at every step.

## v1.1.0 (2026-04-28)

### Commands
- `/devkit:pr-review` — Senior-architect-level review brief for a pull request. Pre-answers "why" questions from git history, triages files by attention need, surfaces convention violations and risks. Reads PR via `gh`, mines `git blame` / `git log` / linked JIRA tickets / similar past PRs.

## v1.0.0 (2026-04-20)

Initial release.

### Commands
- `/devkit:trace` — Auto-instrumented debugging across Android, iOS, React Native, Web, Java, Python

### Skills
- `trace-nudge` — Auto-suggests `/trace` when manually adding debug logs

### Agents
- `codebase-locator` — Find files by topic
- `codebase-analyzer` — Trace execution flow and data paths
- `codebase-pattern-finder` — Find similar implementations and patterns
- `web-search-researcher` — Research library docs and known issues
