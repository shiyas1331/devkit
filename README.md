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

### `/devkit:why` — Why does this code exist?

Replaces the daily 5-minute `git blame` + GitHub-clicking dance with a 10-second answer. Tells you who added the code, when, in which PR, with what reasoning. Pulls blame, originating commit, PR description, linked JIRA ticket, and review-thread highlights into one grounded explanation.

**Usage:**
```
/devkit:why packages/editors/src/api/apiClient.ts:188
/devkit:why apiClient.ts                          # entire file's origin
/devkit:why apiClient.ts:120-150                  # block of lines
/devkit:why apiClient.ts:188 --depth=thorough     # full drilldown
/devkit:why apiClient.ts:188 --json               # machine-readable output
```

**Detects special cases:**
- Code that was added then reverted later
- Code superseded by a follow-up PR
- Lines moved from another file (with rename history)
- Squash merges (uses the squash commit's message)
- Direct pushes to main with no PR

**Confidence-labels** every "why" claim: `high` (explicit in PR/ticket), `medium` (inferred from ticket + diff), `low` (commit subject only).

Used internally by `/devkit:pr-review` for "why" inferences — this command is the single source of truth for git archaeology.

### `/devkit:address-pr` — Address PR review feedback efficiently

Author-side companion to `/devkit:pr-review`. Reads open reviewer comments, classifies them, drafts code fixes for change-requests and replies for questions, commits in smart batches, posts replies, resolves threads, and re-requests review — **all with explicit author approval at every step**.

**Usage:**
```
/devkit:address-pr 409
/devkit:address-pr 409 --dry-run                 # show plan only, no changes
/devkit:address-pr 409 --ignore-bots             # skip CodeRabbit / dependabot etc.
/devkit:address-pr 409 --reviewer=senior-rev     # only this reviewer's comments
/devkit:address-pr 409 --auto-resolve            # mark threads resolved after fixes land
```

**Comment classification:**

| Type | Action |
|---|---|
| change-request | Draft code fix; ask before applying |
| nit | Batch with other nits in the same file → one commit |
| question | Draft reply; queue for batch posting |
| suggestion | Draft both a fix proposal and a discussion reply |
| praise | Acknowledge in summary, no action |
| out-of-scope | Reply acknowledging deferral; do not auto-resolve |
| stale | Detect line already changed; suggest resolving without code change |
| conflict | Surface to author when two reviewers ask for opposing changes — never silently picks one |

**Smart features:**
- Plan before action — full preview, then per-item confirmation
- Push-back drafting — when the author disagrees, helps draft a respectful counter-argument
- Smart commit grouping — nits in same file batched, substantive changes individual
- Stale-comment detection — won't waste time on already-fixed concerns
- Resume from interruption — never starts from scratch on re-run

The author stays in control. Nothing is committed or posted without explicit confirmation.

### `/devkit:pr-review` — Senior-architect-level PR review brief

Generates a calibrated review brief for a pull request. Reads the diff, mines `git blame` / `git log` / linked JIRA tickets / similar past PRs to **pre-answer "why" questions before the reviewer asks them**. Triages files by attention need so the reviewer focuses where it matters.

**Usage:**
```
/devkit:pr-review https://github.com/org/repo/pull/123
/devkit:pr-review 123 --depth=quick
/devkit:pr-review feat/CAT-260-foo --post
/devkit:pr-review 123 --since=abc1234     # re-review mode, only new commits
```

**Flags:**
- `--depth=quick` — TL;DR + Triage only (faster); default is full brief
- `--focus=<glob>` — narrow analysis to matching files
- `--since=<commit>` — only consider diff after the given commit (re-review mode)
- `--post` — after generating, ask permission then post brief as a PR comment
- `--no-jira` — skip JIRA lookup even if a ticket ID is detected

**What the brief contains:**
- TL;DR (60-second read), behavior change in plain English, file triage (🔴 read carefully / 🟡 skim / 🟢 skip)
- Decisions inferred from history with confidence + source attribution
- Open questions for the author (only the unanswerable-from-history ones)
- Convention check, risk highlights, suggested verification steps
- Similar past PRs with outcomes

**Composes with CodeRabbit** (line-level) — `/devkit:pr-review` operates at the decision level; the two are complementary.

Brief is written to `specs/reviews/PR-<num>-<slug>.md` and printed.

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
