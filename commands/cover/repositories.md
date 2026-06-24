---
description: (node) Generate unit tests for every untested Mongoose repository in a package. Per-method files under tests/unit/. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:repositories — node repository batch

Equivalent to `/devkit:cover <path> --batch repositories`. Skips the picker. Node platform only.

Set `CLASSIFICATION=repository`, then read `commands/cover/node-batch.md` and
follow it verbatim with that classification.
