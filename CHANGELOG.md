# Changelog

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
