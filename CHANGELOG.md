# Changelog

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
