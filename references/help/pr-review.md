# /devkit:pr-review — Help

## Scenario menu

```
/devkit:pr-review — pick a mode

📖 READ
  1. Full brief in terminal (default)
     → /devkit:pr-review <PR>
     TL;DR + triage + decisions + conventions + risks. ~60-second read.

  2. Quick TL;DR + triage only
     → /devkit:pr-review <PR> --depth=quick
     Fastest — fits in 30 seconds. Skips deep sections.

📝 SAVE
  3. Save full brief to disk
     → /devkit:pr-review <PR> --save
     Writes specs/reviews/PR-<num>-<slug>.md for later sharing.

💬 POST
  4. Post as a single summary comment
     → /devkit:pr-review <PR> --post
     Drops the whole brief as one PR comment (asks before posting).

  5. Post a full review with inline comments  [recommended for real reviews]
     → /devkit:pr-review <PR> --post-review
     Native code-review style — comments at file:lines + summary body.
     Confirms each inline comment individually before posting.

⚙️  ADVANCED
  6. Re-review only the diff since a commit
     → /devkit:pr-review <PR> --since=<commit>
     For second-round reviews after the author pushed fixes.

  7. Skip JIRA lookup
     → /devkit:pr-review <PR> --no-jira
     Use when JIRA is unreachable or the PR has no ticket.

──────────────────────────────────────────────
Combine modes with commas: `2,4 409` = quick brief + post comment.
Some are mutually exclusive: 1↔2 (READ depth), 4↔5 (POST style).
```

## Number → command mapping

| Reply | Runs as |
|---|---|
| `1 <PR>` | `/devkit:pr-review <PR>` |
| `2 <PR>` | `/devkit:pr-review <PR> --depth=quick` |
| `3 <PR>` | `/devkit:pr-review <PR> --save` |
| `4 <PR>` | `/devkit:pr-review <PR> --post` |
| `5 <PR>` | `/devkit:pr-review <PR> --post-review` |
| `6 <PR> <commit>` | `/devkit:pr-review <PR> --since=<commit>` |
| `7 <PR>` | `/devkit:pr-review <PR> --no-jira` |

For combinations (e.g. `--depth=quick --post`), paste the full command.

## Verbose flag reference

Printed when the user replies `?`.

```
PR identifier (any of):
  • GitHub PR URL, e.g. https://github.com/org/repo/pull/123
  • PR number, e.g. 123 (resolves against current repo's origin)
  • Branch name, e.g. feat/CAT-260-foo

Flags:
  --depth=quick       TL;DR + Triage only (faster); default is full brief.
  --focus=<glob>      Narrow analysis to files matching the glob.
  --since=<commit>    Re-review mode — only diff after the given commit.
  --save              Also write to specs/reviews/PR-<num>-<slug>.md.
  --save=<path>       Write to a specific path.
  --post              Post as a single summary PR comment. Implies --save.
  --post-review       Post a full GitHub review with inline comments. Confirms each.
  --bulk-confirm      With --post-review: one y/n for the whole batch.
  --no-jira           Skip JIRA lookup.
  --help, -h, ?       Show this help.
```
