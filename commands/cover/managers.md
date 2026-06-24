---
description: (node) Generate unit tests for every untested TypeDI manager in a package. Per-method files under tests/unit/. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:managers — node manager batch

Equivalent to `/devkit:cover <path> --batch managers`. Skips the picker. Node platform only.

Set `CLASSIFICATION=manager`, then read `commands/cover/node-batch.md` and follow
it verbatim with that classification.
