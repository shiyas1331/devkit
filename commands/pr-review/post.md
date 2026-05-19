---
description: Post the full brief as a single summary comment on the PR. Confirms before posting. Skips the picker.
argument-hint: <PR>
model: opus
---

# /devkit:pr-review:post — post-as-comment shortcut

Equivalent to `/devkit:pr-review <PR> --post`. Skips the picker.

⚠️ This is a **write action to GitHub.** The command will confirm before actually posting the comment.

## Input

```
$ARGUMENTS
```

If `$ARGUMENTS` is empty, prompt: `"PR? (URL, number, or branch name)"`.

## Execute

Run the canonical pipeline from `commands/pr-review/default.md` (Phase 1 through Phase 4 + quality gates). At Phase 5 (Output):

1. Write the full brief to `specs/reviews/PR-<num>-<short-title-slug>.md` (implicit `--save`).
2. Show first 30 lines of the brief.
3. Ask: `"Post as comment on PR #<num>? (y/n)"`.
4. On `y`: `gh pr comment <PR> --body-file <path>`.
5. Never post without explicit confirmation.

The Phase 1-4 work is unchanged from `default.md`.

## Guardrails

- Always confirm with the user before posting
- DO NOT modify source files
- DO NOT post as a REQUEST_CHANGES review (always COMMENT event type)
