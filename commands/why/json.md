---
description: Machine-readable "why" output. Useful for piping into scripts that auto-file follow-up tickets or correlate code regions to JIRA.
argument-hint: <file:line>
model: opus
---

# /devkit:why:json — JSON output shortcut

Equivalent to `/devkit:why <file:line> --json`. Skips the picker.

Use this when you want to consume the "why" output programmatically rather than reading it. The full structured payload (originating commit, PR, ticket, confidence labels, walk depth) is emitted as a single JSON object.

## Input

```
$ARGUMENTS
```

Expected: a target like `file:line`, `file`, or `file:start-end`.

If `$ARGUMENTS` is empty, prompt: `"Target? (e.g. apiClient.ts:188)"`.

## Execute

Run the canonical pipeline from `commands/why/default.md` (Phase 1 through Phase 4 + quality gates). At Phase 5 (Output), emit ONE JSON object only — no prose, no markdown, no code fences:

```json
{
  "file": "<path>",
  "line": <number or null>,
  "walk": {
    "commits_walked": <N>,
    "last_touched": { "sha": "<sha>", "subject": "<subject>", "classification": "trivial|substantive" },
    "originator": { "sha": "<sha>", "author": "<name>", "date": "<ISO>", "subject": "<subject>" }
  },
  "pr": { "number": <N>, "title": "<title>", "url": "<url>", "merge_method": "squash|merge|rebase" } | null,
  "ticket": { "key": "<key>", "title": "<title>", "url": "<url>" } | null,
  "review_comments": [...],
  "confidence": "high|medium|low|none",
  "special_cases": ["reverted|superseded|moved|renamed|squashed|direct-push|generated-file"],
  "warnings": ["<e.g., working-tree drift, missing ATLASSIAN_TOKEN>"]
}
```

Phases 1-4 work + quality gates are unchanged from `default.md`.

## Guardrails

- Read-only
- Emit JSON only — no surrounding prose or code fences
