---
description: Explain why a piece of code exists. Walks line history to find the originating substantive commit (skips typo fixes, formatting, rename refactors), pulls in the merging PR, linked JIRA ticket, and review-thread debate. Replaces the manual git blame + GitHub click-through dance.
argument-hint: <file:line> or <file> [--depth=quick|thorough] [--max-walk=N] [--json]
model: opus
---

# Why does this code exist? — router

This is a thin dispatcher. The picker fires when there's no flag; otherwise the command parses input and delegates to a sub-command. The full pipeline lives in `commands/why/default.md` — the canonical body that other sub-commands reference.

**Response format — always:**
- Start with the answer (one paragraph). The first sentence is the "why."
- Be direct. No marketing language.

## Input

```
$ARGUMENTS
```

## Routing rules — apply in order

### 1. Picker fires when no flag is present

**Trigger:**
- `$ARGUMENTS` is empty, OR
- `$ARGUMENTS` contains only a target (`file:line` / `file` / `file:start-end`) with no `--*` flag

Use `AskUserQuestion`:

```
question: "How deep should I go?"
header: "Depth"
multiSelect: false
options:
  - label: "Quick why (~10s answer)"
    description: "One paragraph + sources + walk summary."
  - label: "Thorough drilldown"
    description: "Adds PR description, key review-thread debate, secondary edits."
  - label: "JSON output"
    description: "Machine-readable for tooling."
  - label: "Custom (more flags)"
    description: "Combine flags like --max-walk=10 or --depth + --json. Pick this then paste the full command."
```

If `$ARGUMENTS` has no target yet, prompt: `"Target? (e.g. apiClient.ts:188, or apiClient.ts:120-150 for a range)"`.

**Map answer → sub-command and re-invoke:**

| Choice | Re-invoke |
|---|---|
| Quick why | `/devkit:why <target>` (default sub-command) |
| Thorough drilldown | `/devkit:why <target> --depth=thorough` |
| JSON output | `/devkit:why <target> --json` |
| Custom | (prompt user for the full command) |

### 2. Help token → delegate to help sub-command

**Trigger:** `$ARGUMENTS` contains `--help`, `-h`, or `?` as a standalone token.

Delegate to `commands/why/help.md`.

### 3. Flag-based input → delegate to flag sub-command

| Pattern | Delegate to |
|---|---|
| `<target> --depth=thorough` | `commands/why/thorough.md` |
| `<target> --json` | `commands/why/json.md` |
| `<target>` (bare, no flag) | `commands/why/default.md` |

Niche flags (`--max-walk=N`, `--depth=quick`) layer onto whichever base sub-command was chosen.

## Global guardrails (inherited by all sub-commands)

- Read-only. Never modifies files.
- DO NOT commit.
- Source-attribute every claim. Surface confidence + walk count.
- Admit when context is missing. Don't fabricate.

## References

- Canonical pipeline: `commands/why/default.md`
- Help reference: `references/help/why.md`
