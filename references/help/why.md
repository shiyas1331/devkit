# /devkit:why — Help

## Scenario menu

```
/devkit:why — pick a mode

📖 EXPLAIN
  1. Quick why (default)
     → /devkit:why <file:line>
     One paragraph + sources + walk summary. ~10-second answer.

  2. Thorough drilldown
     → /devkit:why <file:line> --depth=thorough
     Adds PR description excerpt, key review-thread points, secondary edits.

🎯 SCOPE
  3. Whole file (not a single line)
     → /devkit:why <file>
     Explains the file's first substantive commit.

  4. Range of lines
     → /devkit:why <file:start-end>
     E.g. /devkit:why apiClient.ts:120-150

🔧 OPTIONS
  5. Walk further back through history
     → /devkit:why <file:line> --max-walk=10
     Default cap is 5 commits — bump for files with deep history.

  6. JSON output (for tooling)
     → /devkit:why <file:line> --json
     Machine-readable output.
```

## Number → command mapping

| Reply | Runs as |
|---|---|
| `1 <file:line>` | `/devkit:why <file:line>` |
| `2 <file:line>` | `/devkit:why <file:line> --depth=thorough` |
| `3 <file>` | `/devkit:why <file>` |
| `4 <file:start-end>` | `/devkit:why <file:start-end>` |
| `5 <file:line> <N>` | `/devkit:why <file:line> --max-walk=<N>` |
| `6 <file:line>` | `/devkit:why <file:line> --json` |

## Verbose flag reference

Printed when the user replies `?`.

```
Target (any of):
  • file:line       — explain that line (most common)
  • file            — explain the file's first substantive commit
  • file:start-end  — explain a range of lines

Flags:
  --depth=quick      One paragraph + sources + walk summary (default).
  --depth=thorough   Adds PR description, review-thread points, secondary edits.
  --max-walk=<N>     Cap on how far back to walk (default 5).
  --json             Machine-readable output.
  --help, -h, ?      Show this help.

How it works:
  Walks back through line history (skipping typo / format / lint / rename / bot
  commits) to find the substantive originator. Pulls in the merging PR, linked
  JIRA ticket, and review-thread debate. Confidence-labels every claim.
```
