---
description: Generate a senior-architect-level review brief for a pull request — pre-answers "why" questions from git history, triages files by attention need, surfaces conventions and risks
argument-hint: <PR url, PR number, or branch name> [--depth=quick] [--focus=<glob>] [--since=<commit>] [--save[=<path>]] [--post] [--post-review] [--bulk-confirm] [--no-jira]
model: opus
---

# PR Review Brief — router

This is a thin dispatcher. The picker fires when there's no flag; otherwise the command parses input and delegates to a sub-command. The full pipeline lives in `commands/pr-review/default.md` — the canonical body that other sub-commands reference.

**Response format:** one short sentence on what was done, the next concrete action, terse.

## Input

```
$ARGUMENTS
```

## Routing rules — apply in order

### 1. Picker fires when no flag is present

**Trigger:**
- `$ARGUMENTS` is empty, OR
- `$ARGUMENTS` contains only a PR identifier (URL / number / branch) with no `--*` flag

Use `AskUserQuestion`. Chained questions: action then depth.

**Question 1 — action:**

```
question: "What do you want to do with the review?"
header: "Action"
multiSelect: false
options:
  - label: "Read the brief"
    description: "Print TL;DR + triage + decisions + risks in the terminal."
  - label: "Save to disk"
    description: "Write the brief to specs/reviews/PR-<num>-<slug>.md."
  - label: "Post as a PR comment"
    description: "Drop the whole brief as one comment on the GitHub PR. Confirms before posting."
  - label: "Post as a full review (inline comments)"
    description: "Native code-review style — comments at file:line with a summary body."
```

If `$ARGUMENTS` has no PR yet, prompt: `"PR? (URL, number, or branch — e.g. 409 or feat/CAT-260-foo)"`.

**Question 2 (only if "Read" or "Save") — depth:**

```
question: "How much depth?"
header: "Depth"
multiSelect: false
options:
  - label: "Full brief (default)"
    description: "Includes TL;DR, triage table, key decisions, conventions, risks."
  - label: "Quick TL;DR only"
    description: "Just the headline + triage table."
```

**Map answer → sub-command and re-invoke:**

| Action | Depth | Re-invoke |
|---|---|---|
| Read | Full | `/devkit:pr-review <PR>` (default sub-command) |
| Read | Quick | `/devkit:pr-review <PR> --depth=quick` |
| Save | Full | `/devkit:pr-review <PR> --save` |
| Save | Quick | `/devkit:pr-review <PR> --depth=quick --save` |
| Post comment | (skip Q2) | `/devkit:pr-review <PR> --post` |
| Post review | (skip Q2) | `/devkit:pr-review <PR> --post-review` |

### 2. Help token → delegate to help sub-command

**Trigger:** `$ARGUMENTS` contains `--help`, `-h`, or `?` as a standalone token.

Delegate to `commands/pr-review/help.md`.

### 3. Flag-based input → delegate to flag sub-command

| Pattern | Delegate to |
|---|---|
| `<PR> --depth=quick` | `commands/pr-review/quick.md` |
| `<PR> --save` (or `--save=<path>`) | `commands/pr-review/save.md` |
| `<PR> --post` | `commands/pr-review/post.md` |
| `<PR> --post-review` | `commands/pr-review/post-review.md` |
| `<PR> --since=<commit>` | `commands/pr-review/since.md` |
| `<PR>` (bare PR, no flag) | `commands/pr-review/default.md` |

Niche flags (`--focus=<glob>`, `--no-jira`, `--bulk-confirm`) layer onto whichever base sub-command was chosen.

## Global guardrails (inherited by all sub-commands)

- DO NOT post to GitHub without explicit user confirmation.
- DO NOT post `REQUEST_CHANGES` or `APPROVE` reviews — let humans block or approve.
- DO NOT commit.
- File:line references on every claim. Confidence labels mandatory on inferences.

## References

- Canonical pipeline: `commands/pr-review/default.md`
- Help reference: `references/help/pr-review.md`
