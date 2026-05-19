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

Run the standard why pipeline from `commands/why.md` with `output=json` pre-selected. Emit ONE JSON object (no prose, no markdown). Schema:

```json
{
  "target": "<file:line or file or file:start-end>",
  "originating": {
    "commit": "<sha>",
    "author": "<name>",
    "date": "<iso>",
    "summary": "<commit subject>"
  },
  "pr": { "number": <int|null>, "title": "...", "url": "..." },
  "ticket": { "id": "...", "url": "...", "title": "..." },
  "confidence": "high|medium|low|none",
  "walk_depth": <int>,
  "skipped_commits": [{ "sha": "...", "reason": "typo|format|lint|rename|bot" }]
}
```

For the full pipeline and schema details, see `commands/why.md`.

## Guardrails

- Read-only
- Emit JSON only — no surrounding prose or code fences
