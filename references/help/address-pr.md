# /devkit:address-pr — Help

## Scenario menu

```
/devkit:address-pr — pick a mode

📖 PLAN
  1. Walk through reviewer comments (default)
     → /devkit:address-pr <PR>
     Classify, plan, walk each item with confirmation, commit, post replies.

  2. Show the plan only — no changes
     → /devkit:address-pr <PR> --dry-run
     Preview what the tool would do before committing to it.

🎯 SCOPE
  3. Skip bot comments
     → /devkit:address-pr <PR> --ignore-bots
     Skip CodeRabbit, dependabot, danger, etc.

  4. Only one reviewer's comments
     → /devkit:address-pr <PR> --reviewer=<login>
     Address @senior-rev's feedback first; ignore others.

⚡ AUTO
  5. Auto-resolve threads after fixes land
     → /devkit:address-pr <PR> --auto-resolve
     Skips per-thread "mark resolved? (y/n)" — useful for clean batches.

──────────────────────────────────────────────
Combine modes with commas: `3,5 409` = ignore bots + auto-resolve threads.
Option 4 needs a login: `4 409 senior-rev`.
```

## Number → command mapping

| Reply | Runs as |
|---|---|
| `1 <PR>` | `/devkit:address-pr <PR>` |
| `2 <PR>` | `/devkit:address-pr <PR> --dry-run` |
| `3 <PR>` | `/devkit:address-pr <PR> --ignore-bots` |
| `4 <PR> <login>` | `/devkit:address-pr <PR> --reviewer=<login>` |
| `5 <PR>` | `/devkit:address-pr <PR> --auto-resolve` |

For combinations (e.g. `--ignore-bots --reviewer=senior-rev`), paste the full command.

## Verbose flag reference

Printed when the user replies `?`.

```
PR identifier (any of):
  • GitHub PR URL, e.g. https://github.com/org/repo/pull/123
  • PR number, e.g. 123 (resolves against current repo's origin)
  • Branch name, e.g. feat/CAT-260-foo

Flags:
  --dry-run            Show the plan but don't apply / commit / post.
  --ignore-bots        Skip bot accounts (CodeRabbit, dependabot, danger, etc.).
  --reviewer=<login>   Only address comments from this reviewer (multi-flag supported).
  --auto-resolve       Mark threads resolved after fixes land (without asking).
  --help, -h, ?        Show this help.
```
