---
description: Read reviewer comments on a PR, classify them, draft fixes for change-requests and replies for questions, commit and post — with author approval at every step
argument-hint: <PR url, PR number, or branch name> [--dry-run] [--ignore-bots] [--reviewer=<login>] [--auto-resolve]
model: opus
---

# Address PR Review Feedback — router

This is a thin dispatcher. The picker fires when there's no flag; otherwise the command parses input and delegates to a sub-command. The full pipeline lives in `commands/address-pr/default.md` — the canonical body that other sub-commands reference.

**Response format:** one short sentence on what was done, the next concrete action, terse.

## Input

```
$ARGUMENTS
```

## Routing rules — apply in order

### 1. Picker fires when no flag is present

**Trigger:**
- `$ARGUMENTS` is empty, OR
- `$ARGUMENTS` contains only a PR identifier with no `--*` flag

Use `AskUserQuestion`:

```
question: "How do you want to address the reviewer comments?"
header: "Mode"
multiSelect: false
options:
  - label: "Walk through each comment (default)"
    description: "Classify, plan, walk every reviewer item with a y/n confirmation. Commits fixes, posts replies."
  - label: "Dry-run (show the plan only)"
    description: "Preview the classification + proposed actions without changing files or posting."
  - label: "Skip bot comments"
    description: "Ignore CodeRabbit, dependabot, danger, etc. Focus on human reviewers."
  - label: "Auto-resolve threads after fixes"
    description: "Skip the per-thread 'mark resolved?' prompt — resolves automatically once the fix lands."
```

If `$ARGUMENTS` has no PR yet, prompt: `"PR? (URL, number, or branch — e.g. 409 or feat/CAT-260-foo)"`.

**Map answer → sub-command and re-invoke:**

| Choice | Re-invoke |
|---|---|
| Walk through | `/devkit:address-pr <PR>` (default sub-command) |
| Dry-run | `/devkit:address-pr <PR> --dry-run` |
| Skip bots | `/devkit:address-pr <PR> --ignore-bots` |
| Auto-resolve | `/devkit:address-pr <PR> --auto-resolve` |

For advanced combos (`--reviewer=<login>`, `--ignore-bots --auto-resolve`), the user types the full command or invokes `--help`.

### 2. Help token → delegate to help sub-command

**Trigger:** `$ARGUMENTS` contains `--help`, `-h`, or `?` as a standalone token.

Delegate to `commands/address-pr/help.md`.

### 3. Flag-based input → delegate to flag sub-command

| Pattern | Delegate to |
|---|---|
| `<PR> --dry-run` | `commands/address-pr/dry-run.md` |
| `<PR> --ignore-bots` | `commands/address-pr/ignore-bots.md` |
| `<PR> --auto-resolve` | `commands/address-pr/auto-resolve.md` |
| `<PR>` (bare PR, no flag) | `commands/address-pr/default.md` |

Niche flags (`--reviewer=<login>`) layer onto whichever base sub-command was chosen.

## Global guardrails (inherited by all sub-commands)

- DO NOT apply or post without explicit user confirmation.
- DO NOT use `git add -A` or `git add .` — only specific paths.
- DO NOT skip hooks (`--no-verify`) unless the user explicitly asks.
- Author stays in control: every action confirmable. Skip / cancel always available.

## References

- Canonical pipeline: `commands/address-pr/default.md`
- Help reference: `references/help/address-pr.md`
