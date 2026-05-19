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

Run the standard pr-review pipeline from `commands/pr-review.md` with `post=true` pre-selected. Generates the full brief, asks confirmation, then posts as a single summary comment.

For the full pipeline, see `commands/pr-review.md`.

## Guardrails

- Always confirm with the user before posting
- DO NOT modify source files
- DO NOT post as a REQUEST_CHANGES review (always COMMENT event type)
